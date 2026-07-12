#!/usr/bin/env node
/**
 * Content pipeline: generates content/<course>/course.json from the compact
 * definitions below. Run `node tools/generate-content.js` after editing.
 *
 * Glyph items (7 orders per family) are derived, never hand-typed, so ids,
 * audio paths and family groupings stay consistent.
 *
 * NOTE: seed vocabulary was chosen to only use glyphs from the seeded
 * families. All content requires native-speaker review before launch.
 */
const fs = require('fs');
const path = require('path');

// Canonical vowel-order suffixes (Ge'ez orders 1..7): ä u i a e ə o
const ORDER_VOWELS = ['ä', 'u', 'i', 'a', 'e', 'ə', 'o'];

// Fidel families shared by both courses (Tigrinya-specific families can be
// appended per-course later, e.g. the ቐ series).
const FAMILIES = [
  { key: 'h', forms: 'ሀ ሁ ሂ ሃ ሄ ህ ሆ' },
  { key: 'l', forms: 'ለ ሉ ሊ ላ ሌ ል ሎ' },
  { key: 'm', forms: 'መ ሙ ሚ ማ ሜ ም ሞ' },
  { key: 's', forms: 'ሰ ሱ ሲ ሳ ሴ ስ ሶ' },
  { key: 'r', forms: 'ረ ሩ ሪ ራ ሬ ር ሮ' },
  { key: 'b', forms: 'በ ቡ ቢ ባ ቤ ብ ቦ' },
  { key: 't', forms: 'ተ ቱ ቲ ታ ቴ ት ቶ' },
  { key: 'n', forms: 'ነ ኑ ኒ ና ኔ ን ኖ' },
  { key: "'", forms: 'አ ኡ ኢ ኣ ኤ እ ኦ', vowelOnly: true },
  { key: 'k', forms: 'ከ ኩ ኪ ካ ኬ ክ ኮ' },
  { key: 'w', forms: 'ወ ዉ ዊ ዋ ዌ ው ዎ' },
  { key: 'd', forms: 'ደ ዱ ዲ ዳ ዴ ድ ዶ' },
  { key: 'y', forms: 'የ ዩ ዪ ያ ዬ ይ ዮ' },
];

const COURSES = {
  amharic: {
    display_name: 'Amharic',
    prefix: 'am',
    audio_strategy: 'tts',
    tts_locale: 'am-ET', // Azure: am-ET (MekdesNeural / AmehaNeural); Google: am-ET
    words: [
      // [id, glyph, transliteration, gloss, tag]
      ['selam', 'ሰላም', 'sälam', 'hello / peace', 'greeting'],
      ['bet', 'ቤት', 'bet', 'house', 'noun'],
      ['weha', 'ውሃ', 'wəha', 'water', 'noun'],
      ['sem', 'ስም', 'səm', 'name', 'noun'],
      ['leb', 'ልብ', 'ləbb', 'heart', 'noun'],
      ['ber', 'በር', 'bärr', 'door', 'noun'],
      ['dabo', 'ዳቦ', 'dabbo', 'bread', 'noun'],
      ['enat', 'እናት', 'ənnat', 'mother', 'noun'],
      ['abat', 'አባት', 'abbat', 'father', 'noun'],
      ['mar', 'ማር', 'mar', 'honey', 'noun'],
      ['sew', 'ሰው', 'säw', 'person', 'noun'],
      ['dem', 'ደም', 'däm', 'blood', 'noun'],
      ['anbesa', 'አንበሳ', 'anbässa', 'lion', 'noun'],
      ['kokeb', 'ኮከብ', 'kokäb', 'star', 'noun'],
      ['mekina', 'መኪና', 'mäkina', 'car', 'noun'],
      ['arat', 'አራት', 'aratt', 'four', 'number'],
    ],
  },
  tigrinya: {
    display_name: 'Tigrinya',
    prefix: 'ti',
    // KNOWN GAP: no production-quality Tigrinya TTS from Azure/Google as of
    // mid-2026. Strategy "recorded" means AudioService expects files at
    // audio_path and will surface a "recording needed" state rather than
    // synthesizing garbage. See README §Audio.
    audio_strategy: 'recorded',
    tts_locale: null,
    words: [
      ['selam', 'ሰላም', 'sälam', 'hello / peace', 'greeting'],
      ['may', 'ማይ', 'may', 'water', 'noun'],
      ['adde', 'ኣደ', 'addä', 'mother', 'noun'],
      ['abbo', 'ኣቦ', 'abbo', 'father', 'noun'],
      ['lebbi', 'ልቢ', 'ləbbi', 'heart', 'noun'],
      ['bani', 'ባኒ', 'bani', 'bread', 'noun'],
      ['seb', 'ሰብ', 'säb', 'person', 'noun'],
      ['dem', 'ደም', 'däm', 'blood', 'noun'],
      ['anbesa', 'ኣንበሳ', 'anbäsa', 'lion', 'noun'],
      ['nehbi', 'ንህቢ', 'nəhbi', 'bee', 'noun'],
      ['temen', 'ተመን', 'tämän', 'snake', 'noun'],
      ['adi', 'ዓዲ', "'addi", 'village / homeland', 'noun'],
    ],
  },
};

// Tigrinya additionally needs the ዓ (ʿayn) family for seed word ዓዲ.
const TIGRINYA_EXTRA = [{ key: 'A', forms: 'ዐ ዑ ዒ ዓ ዔ ዕ ዖ', vowelOnly: true }];

function buildFamilies(list) {
  return list.map((f) => {
    const forms = f.forms.split(' ');
    const romanized = ORDER_VOWELS.map((v, i) =>
      f.vowelOnly ? (f.key === 'A' ? `ʿ${v}` : v) : f.key + v
    );
    return { key: f.key, label: f.vowelOnly ? romanized[3] : f.key, forms, romanized };
  });
}

function slugFamily(key) {
  return key === "'" ? 'glottal' : key === 'A' ? 'ayn' : key;
}

function buildCourse(courseId) {
  const c = COURSES[courseId];
  const famDefs = courseId === 'tigrinya' ? [...FAMILIES, ...TIGRINYA_EXTRA] : FAMILIES;
  const families = buildFamilies(famDefs);

  const items = [];
  for (const fam of families) {
    fam.forms.forEach((glyph, i) => {
      items.push({
        id: `${c.prefix}_g_${slugFamily(fam.key)}${i + 1}`,
        glyph,
        transliteration: fam.romanized[i],
        audio_path: `${c.prefix}/g_${slugFamily(fam.key)}${i + 1}.mp3`,
        english_gloss: null,
        grammar_tag: 'glyph',
        difficulty_tier: 2,
        family_group: fam.key,
        order: i + 1,
      });
    });
  }
  for (const [id, glyph, translit, gloss, tag] of c.words) {
    items.push({
      id: `${c.prefix}_w_${id}`,
      glyph,
      transliteration: translit,
      audio_path: `${c.prefix}/w_${id}.mp3`,
      english_gloss: gloss,
      grammar_tag: tag,
      difficulty_tier: 1,
      family_group: null,
    });
  }

  const wordIds = c.words.map(([id]) => `${c.prefix}_w_${id}`);
  const famKeys = families.map((f) => f.key);
  const glyphIdsFor = (keys, orders = [1, 2, 3, 4, 5, 6, 7]) =>
    items
      .filter((it) => it.grammar_tag === 'glyph' && keys.includes(it.family_group) && orders.includes(it.order))
      .map((it) => it.id);

  const lessons = [];

  // ---- Tier 1 (L1–L5): transliteration-primary, audio-first, word focus ----
  const t1Chunks = [wordIds.slice(0, 4), wordIds.slice(3, 7), wordIds.slice(6, 10), wordIds.slice(9, 13), wordIds.slice(0, 13)];
  const t1Titles = [
    ['First words', 'Hear it, spot it'],
    ['Everyday things', 'Sounds you already know'],
    ['People & home', 'Listening first'],
    ['More words', 'Build your ear–eye link'],
    ['Tier 1 checkpoint', 'Review everything so far'],
  ];
  t1Chunks.forEach((ids, i) => {
    lessons.push({
      id: `${c.prefix}_l${lessons.length + 1}`,
      title: t1Titles[i][0],
      subtitle: t1Titles[i][1],
      tier: 1,
      item_ids: ids.filter(Boolean),
      exercise_weights: { listen_select: 5, multiple_choice: 2 },
      length: 8,
    });
  });

  // ---- Tier 2 (L6–L15): fidel family introductions ----
  // ~1–2 families per lesson across 10 lessons.
  const famPlan = [];
  const keys = [...famKeys];
  while (keys.length) famPlan.push(keys.splice(0, keys.length > (10 - famPlan.length) ? 2 : 1));
  famPlan.slice(0, 10).forEach((group, i) => {
    const labels = group.map((k) => families.find((f) => f.key === k).forms[0]).join(' · ');
    lessons.push({
      id: `${c.prefix}_l${lessons.length + 1}`,
      title: `Family: ${labels}`,
      subtitle: `The 7 orders of ${labels}`,
      tier: 2,
      item_ids: glyphIdsFor(group),
      introduces_families: group,
      exercise_weights: { listen_select: 4, match_pairs: 3, trace_glyph: 2, listen_write: 2 },
      length: 10,
    });
  });

  // ---- Tier 3 (L16–L20): fidel-primary reading & writing ----
  const t3 = [
    ['Read fidel', 'Words, script first', { multiple_choice: 3, listen_select: 3, fill_blank: 2 }],
    ['Missing letters', 'Complete the word', { fill_blank: 4, listen_select: 3 }],
    ['Write what you hear', 'Full fidel dictation', { listen_write: 5, fill_blank: 2 }],
    ['Reading sprint', 'No hints unless you tap', { multiple_choice: 3, fill_blank: 3, listen_write: 2 }],
    ['Tier 3 checkpoint', 'Everything, fidel-first', { listen_write: 3, fill_blank: 3, multiple_choice: 2, listen_select: 2 }],
  ];
  t3.forEach(([title, subtitle, weights]) => {
    lessons.push({
      id: `${c.prefix}_l${lessons.length + 1}`,
      title,
      subtitle,
      tier: 3,
      item_ids: wordIds,
      exercise_weights: weights,
      length: 10,
    });
  });

  return {
    course: courseId,
    display_name: c.display_name,
    audio_strategy: c.audio_strategy,
    tts_locale: c.tts_locale,
    families,
    items,
    lessons,
  };
}

for (const courseId of Object.keys(COURSES)) {
  const course = buildCourse(courseId);
  const out = path.join(__dirname, '..', 'content', courseId, 'course.json');
  fs.writeFileSync(out, JSON.stringify(course, null, 2) + '\n');
  console.log(
    `${courseId}: ${course.families.length} families, ${course.items.length} items, ${course.lessons.length} lessons -> ${out}`
  );
}
