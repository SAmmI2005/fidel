import type { CourseId, DifficultyTier } from '../types/content';

/** 0 wrong · 1 correct-with-hint · 2 correct */
export type Grade = 0 | 1 | 2;

export interface ExerciseProps<E> {
  exercise: E;
  courseId: CourseId;
  tier: DifficultyTier;
  /** Fired exactly once, when the learner locks in an answer. */
  onAnswer: (grade: Grade) => void;
}
