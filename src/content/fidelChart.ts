/**
 * The full fidel chart for free practice — every consonant family × its 7
 * vowel orders, not just the families the lessons have seeded so far.
 *
 * Ethiopic Unicode is regular: each family's 7 orders are consecutive code
 * points starting at the 1st-order glyph, so the chart is generated from the
 * base code point instead of typed out by hand.
 *
 * NATIVE-SPEAKER REVIEW NEEDED: which families each language uses, and the
 * romanization (h/ḥ/ḫ, s/ś, ʾ/ʿ distinctions are written out here even where
 * modern Amharic pronounces them identically). Families the course content
 * already defines use the course's own romanization, so the chart and the
 * lessons always agree.
 */
import type { ContentItem, CourseId } from '../types/content';
import { getCourse } from './loader';

/** Vowel of each order, 1st → 7th (matches the course content convention). */
export const ORDER_VOWELS = ['ä', 'u', 'i', 'a', 'e', 'ə', 'o'] as const;

interface FamilySpec {
  base: number; // code point of the 1st-order glyph
  consonant: string; // romanized consonant ('' for the glottal አ)
  courses: CourseId[];
}

const BOTH: CourseId[] = ['amharic', 'tigrinya'];

// Traditional ሀ ለ ሐ መ … order.
const FAMILIES: FamilySpec[] = [
  { base: 0x1200, consonant: 'h', courses: BOTH }, // ሀ
  { base: 0x1208, consonant: 'l', courses: BOTH }, // ለ
  { base: 0x1210, consonant: 'ḥ', courses: BOTH }, // ሐ
  { base: 0x1218, consonant: 'm', courses: BOTH }, // መ
  { base: 0x1220, consonant: 'ś', courses: ['amharic'] }, // ሠ
  { base: 0x1228, consonant: 'r', courses: BOTH }, // ረ
  { base: 0x1230, consonant: 's', courses: BOTH }, // ሰ
  { base: 0x1238, consonant: 'sh', courses: BOTH }, // ሸ
  { base: 0x1240, consonant: 'q', courses: BOTH }, // ቀ
  { base: 0x1250, consonant: 'qh', courses: ['tigrinya'] }, // ቐ
  { base: 0x1260, consonant: 'b', courses: BOTH }, // በ
  { base: 0x1268, consonant: 'v', courses: BOTH }, // ቨ
  { base: 0x1270, consonant: 't', courses: BOTH }, // ተ
  { base: 0x1278, consonant: 'ch', courses: BOTH }, // ቸ
  { base: 0x1280, consonant: 'ḫ', courses: ['amharic'] }, // ኀ
  { base: 0x1290, consonant: 'n', courses: BOTH }, // ነ
  { base: 0x1298, consonant: 'ñ', courses: BOTH }, // ኘ
  { base: 0x12a0, consonant: '', courses: BOTH }, // አ
  { base: 0x12a8, consonant: 'k', courses: BOTH }, // ከ
  { base: 0x12b8, consonant: 'x', courses: BOTH }, // ኸ
  { base: 0x12c8, consonant: 'w', courses: BOTH }, // ወ
  { base: 0x12d0, consonant: 'ʿ', courses: BOTH }, // ዐ
  { base: 0x12d8, consonant: 'z', courses: BOTH }, // ዘ
  { base: 0x12e0, consonant: 'zh', courses: BOTH }, // ዠ
  { base: 0x12e8, consonant: 'y', courses: BOTH }, // የ
  { base: 0x12f0, consonant: 'd', courses: BOTH }, // ደ
  { base: 0x1300, consonant: 'j', courses: BOTH }, // ጀ
  { base: 0x1308, consonant: 'g', courses: BOTH }, // ገ
  { base: 0x1320, consonant: "t'", courses: BOTH }, // ጠ
  { base: 0x1328, consonant: "ch'", courses: BOTH }, // ጨ
  { base: 0x1330, consonant: "p'", courses: BOTH }, // ጰ
  { base: 0x1338, consonant: "ts'", courses: BOTH }, // ጸ
  { base: 0x1340, consonant: "ṣ'", courses: BOTH }, // ፀ
  { base: 0x1348, consonant: 'f', courses: BOTH }, // ፈ
  { base: 0x1350, consonant: 'p', courses: BOTH }, // ፐ
];

const AUDIO_PREFIX: Record<CourseId, string> = { amharic: 'am', tigrinya: 'ti' };

export interface ChartCell {
  glyph: string;
  roman: string;
  /** 1–7 */
  order: number;
  /** The item to play. A lesson item when the course has one, so recordings are shared. */
  item: ContentItem;
}

export interface ChartRow {
  base: string; // 1st-order glyph, e.g. "ሀ"
  cells: ChartCell[];
}

const cache = new Map<CourseId, ChartRow[]>();

export function chartFor(courseId: CourseId): ChartRow[] {
  const cached = cache.get(courseId);
  if (cached) return cached;

  const { content, glyphItemByChar } = getCourse(courseId);
  const prefix = AUDIO_PREFIX[courseId];

  const rows = FAMILIES.filter((f) => f.courses.includes(courseId)).map((f): ChartRow => {
    const base = String.fromCodePoint(f.base);
    const courseFamily = content.families.find((fam) => fam.forms[0] === base);
    const cells = ORDER_VOWELS.map((vowel, i): ChartCell => {
      const glyph = String.fromCodePoint(f.base + i);
      const roman = courseFamily?.romanized[i] ?? `${f.consonant}${vowel}`;
      const hex = (f.base + i).toString(16);
      const item: ContentItem = glyphItemByChar.get(glyph) ?? {
        id: `${prefix}_chart_${hex}`,
        glyph,
        transliteration: roman,
        // Recording location for letters the lessons don't cover yet.
        audio_path: `${prefix}/chart/${hex}.mp3`,
        english_gloss: null,
        grammar_tag: 'glyph',
        difficulty_tier: 2,
        family_group: courseFamily?.key ?? null,
        order: i + 1,
      };
      return { glyph, roman, order: i + 1, item };
    });
    return { base, cells };
  });

  cache.set(courseId, rows);
  return rows;
}
