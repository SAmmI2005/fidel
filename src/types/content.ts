/**
 * Content schema — the single source of truth.
 *
 * Every exercise in the app is generated from ContentItem records.
 * Nothing lesson-specific is hardcoded in screens: lessons reference
 * item ids, and the exercise engine (src/engine) turns items into
 * exercise instances at runtime.
 */

export type CourseId = 'amharic' | 'tigrinya';

/** 1 = transliteration-primary, 2 = family introduction, 3 = fidel-primary */
export type DifficultyTier = 1 | 2 | 3;

export type GrammarTag =
  | 'glyph'        // a single fidel character (one order of a family)
  | 'noun'
  | 'verb'
  | 'greeting'
  | 'phrase'
  | 'number';

export interface ContentItem {
  /** Stable id, e.g. "am_g_h1" (glyph) or "am_w_selam" (word). Audio is keyed to this. */
  id: string;
  /** The fidel form: a single glyph for grammar_tag "glyph", a word/phrase otherwise. */
  glyph: string;
  /** Latin transliteration shown in tiers 1–2, tap-to-reveal in tier 3. */
  transliteration: string;
  /**
   * Relative path under assets/audio/, e.g. "am/g_h1.mp3".
   * This is a *preference*, not a hard binding: AudioService resolves by item id
   * and falls back to TTS if the file is missing. Swap recordings by replacing
   * the file at this path — no code or content changes needed.
   */
  audio_path: string;
  /** English meaning. Null for bare glyphs, which have sound but no meaning. */
  english_gloss: string | null;
  grammar_tag: GrammarTag;
  /** The lowest tier at which this item may appear. */
  difficulty_tier: DifficultyTier;
  /**
   * Consonant family key for the 7-order groupings, e.g. "h" for ሀ ሁ ሂ ሃ ሄ ህ ሆ.
   * Null for multi-glyph words. Words still relate to families implicitly
   * through the glyphs they contain (computed, not stored).
   */
  family_group: string | null;
  /** 1–7 vowel order within the family (glyphs only). */
  order?: number;
}

export type ExerciseType =
  | 'listen_select'   // hear audio → pick the fidel that matches
  | 'listen_write'    // hear audio → type it on the fidel keyboard
  | 'match_pairs'     // match fidel ↔ transliteration (tier 2 family drill)
  | 'trace_glyph'     // draw over a large glyph outline (tier 2 family drill)
  | 'multiple_choice' // fidel → english meaning
  | 'fill_blank';     // word with one glyph missing → pick the missing glyph

export interface FamilyDef {
  /** Family key, matches ContentItem.family_group */
  key: string;
  /** Base transliteration of the consonant, e.g. "h", "l", "m" */
  label: string;
  /** The 7 orders in canonical order (ä u i a e ə o). Index 0 = 1st order. */
  forms: string[];
  /** Transliterations aligned with forms. */
  romanized: string[];
}

export interface Lesson {
  id: string;
  title: string;
  /** Short subtitle shown on the skill tree node. */
  subtitle: string;
  tier: DifficultyTier;
  /** Item ids taught/drilled in this lesson. */
  item_ids: string[];
  /** Families formally introduced here (drives family-intro UI + keyboard unlocks). */
  introduces_families?: string[];
  /**
   * Optional per-lesson override of exercise-type weights. Merged over the
   * engine's defaults (which already weight audio exercises higher).
   */
  exercise_weights?: Partial<Record<ExerciseType, number>>;
  /** Number of exercises to generate per run. */
  length?: number;
}

export interface CourseContent {
  course: CourseId;
  display_name: string;
  /** Ordered — this is the single skill-tree branch for the MVP. */
  lessons: Lesson[];
  items: ContentItem[];
  families: FamilyDef[];
  /**
   * Audio sourcing metadata. "tts" courses synthesize by default;
   * "recorded" courses expect files at audio_path. Tigrinya ships as
   * "recorded" with a TTS fallback marked unsupported — see README.
   */
  audio_strategy: 'tts' | 'recorded';
  tts_locale: string | null;
}
