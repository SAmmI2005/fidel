import React from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CourseId, DifficultyTier } from '../types/content';
import { getCourse } from '../content/loader';
import { SrsCard, newCard, review } from '../srs/scheduler';

const MAX_HEARTS = 5;
/**
 * MVP: hearts are off so testers never get locked out mid-lesson and every
 * lesson gets played to the end. Flip to true to restore the heart economy
 * (loss on wrong answers, lesson ends at 0, daily refill, UI counters).
 */
export const HEARTS_ENABLED = false;
export const LESSON_BONUS_XP = 20;

export interface CourseProgress {
  /** lesson id -> best accuracy (0..1) across full runs */
  completedLessons: Record<string, number>;
  /** family key -> mastered (introduced + its lesson passed at MASTERY_ACCURACY) */
  masteredFamilies: Record<string, boolean>;
  srs: Record<string, SrsCard>;
  xp: number;
}

interface ProgressState {
  course: CourseId | null;
  byCourse: Record<CourseId, CourseProgress>;
  hearts: number;
  heartsRefilledOn: string; // yyyy-mm-dd
  streak: number;
  lastActiveDay: string;

  // --- derived helpers ---
  tier: () => DifficultyTier;
  isLessonUnlocked: (lessonId: string) => boolean;

  // --- actions ---
  chooseCourse: (c: CourseId) => void;
  recordAnswer: (itemId: string, grade: 0 | 1 | 2) => void;
  completeLesson: (lessonId: string, accuracy: number) => void;
  loseHeart: () => number;
  touchDay: () => void;
  resetHeartsIfNewDay: () => void;
}

const emptyCourse = (): CourseProgress => ({
  completedLessons: {},
  masteredFamilies: {},
  srs: {},
  xp: 0,
});

/** Accuracy a lesson run needs before its new families count as mastered. */
export const MASTERY_ACCURACY = 0.8;

/** Local calendar day (yyyy-mm-dd) — streaks and heart refills follow the user's clock, not UTC. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDay(new Date());
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1); // calendar arithmetic, safe across DST changes
  return localDay(d);
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      course: null,
      byCourse: { amharic: emptyCourse(), tigrinya: emptyCourse() },
      hearts: MAX_HEARTS,
      heartsRefilledOn: today(),
      streak: 0,
      lastActiveDay: '',

      /**
       * User's current tier in the active course. Tier is *earned*, not just
       * positional: tier 2 requires finishing all tier-1 lessons; tier 3
       * requires tier 2 done AND every seeded family mastered. This is what
       * gates both lesson unlocks and how TierText renders.
       */
      tier: () => {
        const s = get();
        if (!s.course) return 1;
        const { content } = getCourse(s.course);
        const p = s.byCourse[s.course];
        const done = (t: DifficultyTier) =>
          content.lessons.filter((l) => l.tier === t).every((l) => p.completedLessons[l.id] != null);
        const allFamilies = content.families.every((f) => p.masteredFamilies[f.key]);
        if (done(1) && done(2) && allFamilies) return 3;
        if (done(1)) return 2;
        return 1;
      },

      /** Sequential unlock: a lesson opens when the previous one is complete. */
      isLessonUnlocked: (lessonId) => {
        const s = get();
        if (!s.course) return false;
        const { content } = getCourse(s.course);
        const idx = content.lessons.findIndex((l) => l.id === lessonId);
        if (idx <= 0) return idx === 0;
        const prev = content.lessons[idx - 1];
        return s.byCourse[s.course].completedLessons[prev.id] != null;
      },

      chooseCourse: (c) => set({ course: c }),

      recordAnswer: (itemId, grade) =>
        set((s) => {
          if (!s.course) return s;
          const p = s.byCourse[s.course];
          const card = p.srs[itemId] ?? newCard(itemId);
          return {
            byCourse: {
              ...s.byCourse,
              [s.course]: {
                ...p,
                srs: { ...p.srs, [itemId]: review(card, grade) },
                xp: p.xp + (grade === 2 ? 10 : grade === 1 ? 5 : 0),
              },
            },
          };
        }),

      completeLesson: (lessonId, accuracy) =>
        set((s) => {
          if (!s.course) return s;
          const { lessonById } = getCourse(s.course);
          const lesson = lessonById.get(lessonId);
          const p = s.byCourse[s.course];
          const mastered = { ...p.masteredFamilies };
          // Finishing always unlocks the next lesson; mastery has to be earned.
          // A weak run can be replayed later to master the families.
          if (accuracy >= MASTERY_ACCURACY) {
            for (const f of lesson?.introduces_families ?? []) mastered[f] = true;
          }
          const previousBest = p.completedLessons[lessonId];
          return {
            byCourse: {
              ...s.byCourse,
              [s.course]: {
                ...p,
                completedLessons: { ...p.completedLessons, [lessonId]: Math.max(accuracy, previousBest ?? 0) },
                masteredFamilies: mastered,
                xp: p.xp + (previousBest == null ? LESSON_BONUS_XP : 0), // bonus on first completion only
              },
            },
          };
        }),

      loseHeart: () => {
        if (!HEARTS_ENABLED) return MAX_HEARTS;
        const next = Math.max(0, get().hearts - 1);
        set({ hearts: next });
        return next;
      },

      /** Streak bookkeeping — call once per app foreground / lesson start. */
      touchDay: () =>
        set((s) => {
          const t = today();
          if (s.lastActiveDay === t) return s;
          const streak = s.lastActiveDay === yesterday() ? s.streak + 1 : 1;
          return { streak, lastActiveDay: t };
        }),

      /** MVP heart economy: full refill each calendar day. */
      resetHeartsIfNewDay: () =>
        set((s) =>
          s.heartsRefilledOn === today() ? s : { hearts: MAX_HEARTS, heartsRefilledOn: today() }
        ),
    }),
    { name: 'fidel-progress-v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);

export { MAX_HEARTS };

/**
 * Streak as the user should see it. The stored `streak` only changes when they
 * practice, so after missed days it would still show the old number until the
 * next lesson. A streak is alive only if they practiced today or yesterday.
 */
export const selectDisplayStreak = (s: Pick<ProgressState, 'streak' | 'lastActiveDay'>) =>
  s.lastActiveDay === today() || s.lastActiveDay === yesterday() ? s.streak : 0;

/**
 * Progress loads from AsyncStorage asynchronously. Anything that decides
 * based on saved state at startup (e.g. the first screen) must wait for this,
 * or returning users look like new ones for the first render.
 */
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(() => useProgressStore.persist.hasHydrated());
  React.useEffect(() => {
    const unsub = useProgressStore.persist.onFinishHydration(() => setHydrated(true));
    if (useProgressStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
