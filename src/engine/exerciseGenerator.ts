/**
 * Exercise engine. Input: a Lesson (item ids + optional weight overrides),
 * the user's tier, and SRS-due items. Output: a shuffled list of Exercise
 * instances. Screens render whatever comes out; no exercise is hardcoded
 * to a lesson.
 *
 * Audio-first by design: heritage speakers already parse the spoken
 * language — their gap is sound→script mapping — so listen_* types carry
 * the highest default weights.
 */
import type { ContentItem, CourseId, DifficultyTier, ExerciseType, Lesson } from '../types/content';
import { getCourse, decompose } from '../content/loader';

export interface BaseExercise {
  id: string;
  type: ExerciseType;
  /** The item being tested — SRS grades attach to this id. */
  target: ContentItem;
}

export interface ListenSelectExercise extends BaseExercise {
  type: 'listen_select';
  choices: ContentItem[]; // includes target; render glyphs, play target audio
}
export interface ListenWriteExercise extends BaseExercise {
  type: 'listen_write';
  answerGlyphs: ContentItem[]; // expected keyboard sequence
}
export interface MatchPairsExercise extends BaseExercise {
  type: 'match_pairs';
  pairs: ContentItem[]; // 4–5 glyphs; match glyph ↔ transliteration
}
export interface TraceGlyphExercise extends BaseExercise {
  type: 'trace_glyph';
}
export interface MultipleChoiceExercise extends BaseExercise {
  type: 'multiple_choice';
  choices: { label: string; correct: boolean }[]; // english glosses
}
export interface FillBlankExercise extends BaseExercise {
  type: 'fill_blank';
  shownGlyphs: (ContentItem | null)[]; // null = the blank
  blankIndex: number;
  choices: ContentItem[]; // glyph options for the blank
}

export type Exercise =
  | ListenSelectExercise
  | ListenWriteExercise
  | MatchPairsExercise
  | TraceGlyphExercise
  | MultipleChoiceExercise
  | FillBlankExercise;

/** Audio types weighted highest by default; lessons may override. */
const DEFAULT_WEIGHTS: Record<ExerciseType, number> = {
  listen_select: 4,
  listen_write: 3,
  match_pairs: 2,
  trace_glyph: 1,
  multiple_choice: 2,
  fill_blank: 2,
};

/** Which types make sense for a given item + tier. */
function eligibleTypes(item: ContentItem, tier: DifficultyTier): ExerciseType[] {
  const isGlyph = item.grammar_tag === 'glyph';
  const types: ExerciseType[] = ['listen_select'];
  if (isGlyph) {
    types.push('match_pairs', 'trace_glyph');
    if (tier >= 2) types.push('listen_write');
  } else {
    if (item.english_gloss) types.push('multiple_choice');
    if (tier >= 2) types.push('fill_blank');
    if (tier >= 3) types.push('listen_write');
  }
  return types;
}

/** Weighted pick. A weight of 0 disables a type; if every option is 0, pick uniformly. */
function pickWeighted<T extends string>(options: T[], weights: Partial<Record<T, number>>, rng: () => number): T {
  const w = options.map((o) => Math.max(0, weights[o] ?? 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return options[Math.floor(rng() * options.length)];
  let roll = rng() * total;
  for (let i = 0; i < options.length; i++) {
    if (w[i] <= 0) continue;
    roll -= w[i];
    if (roll <= 0) return options[i];
  }
  for (let i = options.length - 1; i >= 0; i--) if (w[i] > 0) return options[i]; // float rounding
  return options[0];
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Distractors: same family first (the genuinely confusable ones), then same tag,
 * then any item of the same kind (glyph vs word). The last tier matters for
 * one-of-a-kind tags (e.g. the only 'greeting'), which otherwise got zero
 * distractors and produced single-option questions.
 */
function distractorsFor(courseId: CourseId, target: ContentItem, n: number, rng: () => number): ContentItem[] {
  const { content } = getCourse(courseId);
  const isGlyph = (i: ContentItem) => i.grammar_tag === 'glyph';
  const others = content.items.filter((i) => i.id !== target.id && isGlyph(i) === isGlyph(target));
  const sameTag = others.filter((i) => i.grammar_tag === target.grammar_tag);
  const sameFamily = sameTag.filter((i) => target.family_group && i.family_group === target.family_group);
  const restOfTag = sameTag.filter((i) => !sameFamily.includes(i));
  const restOfKind = others.filter((i) => !sameTag.includes(i));
  const ordered = [...shuffle(sameFamily, rng), ...shuffle(restOfTag, rng), ...shuffle(restOfKind, rng)];

  // Never offer two options that read or sound the same (e.g. ሀ and ሐ are both
  // "hä" in Amharic) — the question would have two right answers.
  const seen = new Set([target.transliteration, target.glyph]);
  const picked: ContentItem[] = [];
  for (const item of ordered) {
    if (picked.length >= n) break;
    if (seen.has(item.transliteration) || seen.has(item.glyph)) continue;
    seen.add(item.transliteration);
    seen.add(item.glyph);
    picked.push(item);
  }
  return picked;
}

let counter = 0;
const eid = () => `ex_${++counter}`;

function buildExercise(
  courseId: CourseId,
  item: ContentItem,
  type: ExerciseType,
  rng: () => number
): Exercise | null {
  switch (type) {
    case 'listen_select': {
      const choices = shuffle([item, ...distractorsFor(courseId, item, 3, rng)], rng);
      return { id: eid(), type, target: item, choices };
    }
    case 'listen_write': {
      const answerGlyphs = item.grammar_tag === 'glyph' ? [item] : decompose(courseId, item.glyph);
      if (!answerGlyphs.length) return null;
      return { id: eid(), type, target: item, answerGlyphs };
    }
    case 'match_pairs': {
      const pairs = [item, ...distractorsFor(courseId, item, 3, rng)].filter(
        (i) => i.grammar_tag === 'glyph'
      );
      if (pairs.length < 3) return null;
      return { id: eid(), type, target: item, pairs };
    }
    case 'trace_glyph':
      return item.grammar_tag === 'glyph' ? { id: eid(), type, target: item } : null;
    case 'multiple_choice': {
      if (!item.english_gloss) return null;
      const wrong = distractorsFor(courseId, item, 3, rng)
        .map((i) => i.english_gloss)
        .filter((g): g is string => !!g)
        .slice(0, 3);
      if (wrong.length < 2) return null;
      const choices = shuffle(
        [{ label: item.english_gloss, correct: true }, ...wrong.map((label) => ({ label, correct: false }))],
        rng
      );
      return { id: eid(), type, target: item, choices };
    }
    case 'fill_blank': {
      const glyphs = decompose(courseId, item.glyph);
      if (glyphs.length < 2) return null;
      const blankIndex = Math.floor(rng() * glyphs.length);
      const missing = glyphs[blankIndex];
      const shownGlyphs = glyphs.map((g, i) => (i === blankIndex ? null : g));
      const choices = shuffle([missing, ...distractorsFor(courseId, missing, 3, rng)], rng);
      return { id: eid(), type, target: item, blankIndex, shownGlyphs, choices };
    }
  }
}

export interface GenerateOptions {
  courseId: CourseId;
  lesson: Lesson;
  tier: DifficultyTier;
  /** SRS-due item ids to weave in (≈20% of the session). */
  reviewItemIds?: string[];
  seed?: number;
}

export function generateLessonExercises(opts: GenerateOptions): Exercise[] {
  const { courseId, lesson, tier, reviewItemIds = [] } = opts;
  const { itemById } = getCourse(courseId);
  let s = opts.seed ?? Date.now();
  const rng = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const weights = { ...DEFAULT_WEIGHTS, ...lesson.exercise_weights };
  const length = lesson.length ?? 8;

  const lessonItems = lesson.item_ids.map((id) => itemById.get(id)).filter((x): x is ContentItem => !!x);
  const reviewItems = reviewItemIds
    .map((id) => itemById.get(id))
    .filter((x): x is ContentItem => !!x && !lesson.item_ids.includes(x.id));

  const reviewCount = Math.min(reviewItems.length, Math.round(length * 0.2));
  const picked: ContentItem[] = [];
  // Shuffle before cycling: lessons can hold more items than exercises, and
  // without this the items past the first `length` would never appear.
  const pool = shuffle(lessonItems, rng);
  for (let i = 0; i < length - reviewCount && pool.length; i++) picked.push(pool[i % pool.length]);
  picked.push(...shuffle(reviewItems, rng).slice(0, reviewCount));

  const exercises: Exercise[] = [];
  for (const item of shuffle(picked, rng)) {
    const types = eligibleTypes(item, tier);
    // a few attempts in case the chosen type can't be built for this item
    let built: Exercise | null = null;
    for (let attempt = 0; attempt < 4 && !built; attempt++) {
      built = buildExercise(courseId, item, pickWeighted(types, weights, rng), rng);
    }
    // listen_select can always be built — never silently drop an item
    built ??= buildExercise(courseId, item, 'listen_select', rng);
    if (built) exercises.push(built);
  }
  return exercises;
}

/** Standalone review session built purely from SRS-due items. */
export function generateReviewExercises(
  courseId: CourseId,
  tier: DifficultyTier,
  itemIds: string[],
  seed?: number
): Exercise[] {
  const { itemById } = getCourse(courseId);
  const lesson: Lesson = {
    id: '__review__',
    title: 'Review',
    subtitle: '',
    tier,
    item_ids: itemIds.filter((id) => itemById.has(id)),
    length: Math.min(10, itemIds.length || 1),
  };
  return generateLessonExercises({ courseId, lesson, tier, seed });
}
