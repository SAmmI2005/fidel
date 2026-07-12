import type { ContentItem, CourseContent, CourseId, FamilyDef, Lesson } from '../types/content';

// Bundled at build time; swap for remote fetch + cache when content outgrows the bundle.
import amharic from '../../content/amharic/course.json';
import tigrinya from '../../content/tigrinya/course.json';

const COURSES: Record<CourseId, CourseContent> = {
  amharic: amharic as unknown as CourseContent,
  tigrinya: tigrinya as unknown as CourseContent,
};

export interface CourseIndex {
  content: CourseContent;
  itemById: Map<string, ContentItem>;
  familyByKey: Map<string, FamilyDef>;
  /** glyph character -> its ContentItem (glyph items only) */
  glyphItemByChar: Map<string, ContentItem>;
  lessonById: Map<string, Lesson>;
}

const indexCache = new Map<CourseId, CourseIndex>();

export function getCourse(courseId: CourseId): CourseIndex {
  const cached = indexCache.get(courseId);
  if (cached) return cached;

  const content = COURSES[courseId];
  const itemById = new Map(content.items.map((i) => [i.id, i]));
  const familyByKey = new Map(content.families.map((f) => [f.key, f]));
  const glyphItemByChar = new Map(
    content.items.filter((i) => i.grammar_tag === 'glyph').map((i) => [i.glyph, i])
  );
  const idx: CourseIndex = {
    content,
    itemById,
    familyByKey,
    glyphItemByChar,
    lessonById: new Map(content.lessons.map((l) => [l.id, l])),
  };
  indexCache.set(courseId, idx);
  return idx;
}

/** Decompose a word into its constituent glyph items (drives fill_blank + keyboard checking). */
export function decompose(courseId: CourseId, word: string): ContentItem[] {
  const { glyphItemByChar } = getCourse(courseId);
  return [...word].map((ch) => glyphItemByChar.get(ch)).filter((x): x is ContentItem => !!x);
}

/** Family keys a word touches — used to gate tier-3 word drills on family mastery. */
export function familiesOf(courseId: CourseId, word: string): string[] {
  return [...new Set(decompose(courseId, word).map((g) => g.family_group!).filter(Boolean))];
}
