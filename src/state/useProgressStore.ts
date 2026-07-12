import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CourseId, DifficultyTier } from '../types/content';
import { getCourse } from '../content/loader';
import { SrsCard, newCard, review } from '../srs/scheduler';

const MAX_HEARTS = 5;

export interface CourseProgress {
  /** lesson id -> best completion (0..1 accuracy of last full run) */
  completedLessons: Record<string, number>;
  /** family key -> mastered (introduced + passed its lesson) */
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

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

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
          for (const f of lesson?.introduces_families ?? []) mastered[f] = true;
          return {
            byCourse: {
              ...s.byCourse,
              [s.course]: {
                ...p,
                completedLessons: { ...p.completedLessons, [lessonId]: accuracy },
                masteredFamilies: mastered,
                xp: p.xp + 20, // lesson-completion bonus
              },
            },
          };
        }),

      loseHeart: () => {
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
