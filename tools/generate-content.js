#!/usr/bin/env node
/**
 * Content pipeline: generates content/<course>/course.json from the compact
 * definitions below. Run `node tools/generate-content.js` after editing.
 *
 * Each course is 50 lessons, easier → harder:
 *   1. Letter lessons — one consonant family at a time, most regular and
 *      useful first; sound-alike, rare and labialized (-wa) letters last.
 *   2. Real words appear automatically in the first lesson where every letter
 *      in them has been taught (so every word shown is readable).
 *   3. A checkpoint every 3–4 lessons mixes recent letters and words.
 *   4. Fidel-first reading lessons by theme, dictation, and a final review.
 *
 * Glyph items are derived from Unicode, never hand-typed: each Ethiopic
 * family's 7 orders are consecutive code points from its 1st-order glyph.
 * Item ids and audio paths are stable (e.g. am_g_l3 → am/g_l3.mp3), so
 * recordings and saved progress survive regeneration.
 *
 * The script validates its own output and exits non-zero on any problem.
 * All vocabulary, transliterations and lesson order need native-speaker
 * review before launch.
 */
const fs = require('fs');
const path = require('path');

// Canonical vowel-order suffixes (orders 1..7)
const ORDER_VOWELS = ['ä', 'u', 'i', 'a', 'e', 'ə', 'o'];
const TOTAL_LESSONS = 50;
/** Max new words introduced in one letter lesson (the rest wait for the checkpoint). */
const MAX_WORDS_PER_LETTER_LESSON = 3;

/** 1st-order code point of each family. Keys double as stable id slugs. */
const FAMILY_BASES = {
  h: 0x1200, // ሀ
  l: 0x1208, // ለ
  hx: 0x1210, // ሐ
  m: 0x1218, // መ
  sx: 0x1220, // ሠ
  r: 0x1228, // ረ
  s: 0x1230, // ሰ
  sh: 0x1238, // ሸ
  q: 0x1240, // ቀ
  qh: 0x1250, // ቐ
  b: 0x1260, // በ
  v: 0x1268, // ቨ
  t: 0x1270, // ተ
  ch: 0x1278, // ቸ
  hh: 0x1280, // ኀ
  n: 0x1290, // ነ
  ny: 0x1298, // ኘ
  "'": 0x12a0, // አ
  k: 0x12a8, // ከ
  kh: 0x12b8, // ኸ
  w: 0x12c8, // ወ
  A: 0x12d0, // ዐ
  z: 0x12d8, // ዘ
  zh: 0x12e0, // ዠ
  y: 0x12e8, // የ
  d: 0x12f0, // ደ
  j: 0x1300, // ጀ
  g: 0x1308, // ገ
  tx: 0x1320, // ጠ
  chx: 0x1328, // ጨ
  px: 0x1330, // ጰ
  ts: 0x1338, // ጸ
  tsx: 0x1340, // ፀ
  f: 0x1348, // ፈ
  p: 0x1350, // ፐ
};

/**
 * Labialized "-wa" forms aren't a 7-order family; they're grouped in sevens
 * so they can be drilled with the same exercises. For ለ መ ሰ ረ በ ተ ነ ዘ ደ ጠ ፈ
 * the -wa form sits in the family's 8th code point.
 */
const cp = String.fromCodePoint;
const WA_GROUPS = {
  lwa: {
    label: '-wa forms',
    forms: ['l', 'm', 's', 'r', 'b', 't', 'n'].map((k) => cp(FAMILY_BASES[k] + 7)), // ሏ ሟ ሷ ሯ ቧ ቷ ኗ
    romanized: ['lwa', 'mwa', 'swa', 'rwa', 'bwa', 'twa', 'nwa'],
  },
  kwa: {
    label: '-wa forms',
    // ቋ ኳ ጓ have their own labialized rows; ዟ ዷ ጧ ፏ are 8th code points
    forms: [cp(0x124b), cp(0x12b3), cp(0x1313), ...['z', 'd', 'tx', 'f'].map((k) => cp(FAMILY_BASES[k] + 7))],
    romanized: ['qwa', 'kwa', 'gwa', 'zwa', 'dwa', "t'wa", 'fwa'],
  },
};

const SLUG_OVERRIDES = { "'": 'glottal', A: 'ayn' };
const slug = (key) => SLUG_OVERRIDES[key] ?? key;

const THEME_TITLES = {
  family: 'Family & people',
  food: 'Food & drink',
  animals: 'Animals',
  body: 'The body',
  numbers: 'Numbers',
  places: 'Home & town',
  nature: 'Nature',
  everyday: 'Everyday words',
};
const THEME_ORDER = ['family', 'food', 'animals', 'body', 'numbers', 'places', 'nature', 'everyday'];

// Plan steps: an array of family keys = one letter lesson; 'checkpoint' =
// review of everything since the last checkpoint; 'checkpoint-all' = review
// of every letter. Remaining lessons up to 50 are filled with themed reading,
// dictation and a final review.
const COURSES = {
  amharic: {
    display_name: 'Amharic',
    prefix: 'am',
    audio_strategy: 'tts',
    tts_locale: 'am-ET',
    tier1Lessons: 2,
    // Modern Amharic pronounces ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ and ጸ/ፀ alike, so they share
    // a spelling here; the "same sound, different letter" lessons teach them.
    roman: {
      h: 'h', l: 'l', hx: 'h', m: 'm', sx: 's', r: 'r', s: 's', sh: 'sh', q: 'q', b: 'b', v: 'v',
      t: 't', ch: 'ch', hh: 'h', n: 'n', ny: 'ñ', "'": '', k: 'k', kh: 'x', w: 'w', A: '', z: 'z',
      zh: 'zh', y: 'y', d: 'd', j: 'j', g: 'g', tx: "t'", chx: "ch'", px: "p'", ts: "ts'", tsx: "ts'",
      f: 'f', p: 'p',
    },
    plan: [
      ['l'], ['m'], ['s'], ['b'], ['t'], 'checkpoint',
      ["'"], ['n'], ['r'], 'checkpoint',
      ['d'], ['w'], ['h'], 'checkpoint',
      ['k'], ['y'], ['g'], 'checkpoint',
      ['q'], ['f'], ['z'], 'checkpoint',
      ['tx'], ['ch'], ['sh'], 'checkpoint',
      ['j'], ['ny'], ['chx'], 'checkpoint',
      ['ts'], ['p', 'px'], ['v', 'zh', 'kh'], ['hx', 'hh'], ['sx', 'A', 'tsx'], 'checkpoint',
      ['lwa'], ['kwa'], 'checkpoint-all',
    ],
    words: [
      // [id, glyph, transliteration, gloss, tag, theme]
      ['lam', 'ላም', 'lam', 'cow', 'noun', 'animals'],
      ['lomi', 'ሎሚ', 'lomi', 'lemon', 'noun', 'food'],
      ['selam', 'ሰላም', 'sälam', 'hello / peace', 'greeting', 'everyday'],
      ['sem', 'ስም', 'səm', 'name', 'noun', 'everyday'],
      ['leb', 'ልብ', 'ləbb', 'heart', 'noun', 'body'],
      ['bal', 'ባል', 'bal', 'husband', 'noun', 'family'],
      ['bet', 'ቤት', 'bet', 'house', 'noun', 'places'],
      ['sost', 'ሶስት', 'sost', 'three', 'number', 'numbers'],
      ['beteseb', 'ቤተሰብ', 'betäsäb', 'family', 'noun', 'family'],
      ['abat', 'አባት', 'abbat', 'father', 'noun', 'family'],
      ['amest', 'አምስት', 'amməst', 'five', 'number', 'numbers'],
      ['esat', 'እሳት', 'əsat', 'fire', 'noun', 'nature'],
      ['asa', 'አሳ', 'asa', 'fish', 'noun', 'animals'],
      ['enat', 'እናት', 'ənnat', 'mother', 'noun', 'family'],
      ['anbesa', 'አንበሳ', 'anbässa', 'lion', 'noun', 'animals'],
      ['samuna', 'ሳሙና', 'samuna', 'soap', 'noun', 'everyday'],
      ['buna', 'ቡና', 'buna', 'coffee', 'noun', 'food'],
      ['seni', 'ስኒ', 'səni', 'cup', 'noun', 'everyday'],
      ['ber', 'በር', 'bärr', 'door', 'noun', 'places'],
      ['mar', 'ማር', 'mar', 'honey', 'noun', 'food'],
      ['arat', 'አራት', 'aratt', 'four', 'number', 'numbers'],
      ['temari', 'ተማሪ', 'tämari', 'student', 'noun', 'family'],
      ['ras', 'ራስ', 'ras', 'head', 'noun', 'body'],
      ['bere', 'በሬ', 'bäre', 'ox', 'noun', 'animals'],
      ['asser', 'አስር', 'assər', 'ten', 'number', 'numbers'],
      ['dem', 'ደም', 'däm', 'blood', 'noun', 'body'],
      ['dabo', 'ዳቦ', 'dabbo', 'bread', 'noun', 'food'],
      ['demet', 'ድመት', 'dəmmät', 'cat', 'noun', 'animals'],
      ['debter', 'ደብተር', 'däbtär', 'notebook', 'noun', 'everyday'],
      ['wetet', 'ወተት', 'wätät', 'milk', 'noun', 'food'],
      ['wendem', 'ወንድም', 'wändəm', 'brother', 'noun', 'family'],
      ['sew', 'ሰው', 'säw', 'person', 'noun', 'family'],
      ['weha', 'ውሃ', 'wəha', 'water', 'noun', 'nature'],
      ['hod', 'ሆድ', 'hod', 'stomach', 'noun', 'body'],
      ['hulet', 'ሁለት', 'hulätt', 'two', 'number', 'numbers'],
      ['berhan', 'ብርሃን', 'bərhan', 'light', 'noun', 'nature'],
      ['kokeb', 'ኮከብ', 'kokäb', 'star', 'noun', 'nature'],
      ['mekina', 'መኪና', 'mäkina', 'car', 'noun', 'places'],
      ['ketema', 'ከተማ', 'kätäma', 'city', 'noun', 'places'],
      ['kremt', 'ክረምት', 'kərämt', 'rainy season', 'noun', 'nature'],
      ['semay', 'ሰማይ', 'sämay', 'sky', 'noun', 'nature'],
      ['yet', 'የት', 'yät', 'where?', 'phrase', 'everyday'],
      ['gebeya', 'ገበያ', 'gäbäya', 'market', 'noun', 'places'],
      ['beg', 'በግ', 'bäg', 'sheep', 'noun', 'animals'],
      ['hager', 'ሀገር', 'hagär', 'country', 'noun', 'places'],
      ['qen', 'ቀን', 'qän', 'day', 'noun', 'everyday'],
      ['qey', 'ቀይ', 'qäy', 'red', 'noun', 'everyday'],
      ['qelem', 'ቀለም', 'qäläm', 'colour / ink', 'noun', 'everyday'],
      ['feres', 'ፈረስ', 'färäs', 'horse', 'noun', 'animals'],
      ['fit', 'ፊት', 'fit', 'face', 'noun', 'body'],
      ['feqer', 'ፍቅር', 'fəqər', 'love', 'noun', 'everyday'],
      ['genzeb', 'ገንዘብ', 'gänzäb', 'money', 'noun', 'everyday'],
      ['ruz', 'ሩዝ', 'ruz', 'rice', 'noun', 'food'],
      ['zemed', 'ዘመድ', 'zämäd', 'relative', 'noun', 'family'],
      ['zaf', 'ዛፍ', 'zaf', 'tree', 'noun', 'nature'],
      ['tena', 'ጤና', "t'ena", 'health', 'noun', 'everyday'],
      ['quter', 'ቁጥር', "qut'ər", 'number', 'noun', 'numbers'],
      ['ters', 'ጥርስ', "t'ərs", 'tooth', 'noun', 'body'],
      ['chigger', 'ችግር', 'chəggər', 'problem', 'noun', 'everyday'],
      ['cher', 'ቸር', 'chär', 'kind / generous', 'noun', 'everyday'],
      ['wesha', 'ውሻ', 'wəsha', 'dog', 'noun', 'animals'],
      ['shenkurt', 'ሽንኩርት', 'shənkurt', 'onion', 'noun', 'food'],
      ['shay', 'ሻይ', 'shay', 'tea', 'noun', 'food'],
      ['lej', 'ልጅ', 'ləj', 'child', 'noun', 'family'],
      ['joro', 'ጆሮ', 'joro', 'ear', 'noun', 'body'],
      ['ej', 'እጅ', 'əjj', 'hand', 'noun', 'body'],
      ['amarenya', 'አማርኛ', 'amarəñña', 'Amharic (language)', 'noun', 'everyday'],
      ['chew', 'ጨው', "ch'äw", 'salt', 'noun', 'food'],
      ['chama', 'ጫማ', "ch'amma", 'shoe', 'noun', 'everyday'],
      ['chereqa', 'ጨረቃ', "ch'äräqa", 'moon', 'noun', 'nature'],
      ['tselot', 'ጸሎት', "ts'älot", 'prayer', 'noun', 'everyday'],
      ['tsegur', 'ጸጉር', "ts'ägur", 'hair', 'noun', 'body'],
      ['pasta', 'ፓስታ', 'pasta', 'pasta', 'noun', 'food'],
      ['terepeza', 'ጠረጴዛ', "t'äräp'eza", 'table', 'noun', 'places'],
      ['television', 'ቴሌቪዥን', 'televizhən', 'television', 'noun', 'everyday'],
      ['hamus', 'ሐሙስ', 'hamus', 'Thursday', 'noun', 'everyday'],
      ['hakim', 'ሐኪም', 'hakim', 'doctor', 'noun', 'family'],
      ['hayl', 'ኃይል', 'hayl', 'power / strength', 'noun', 'everyday'],
      ['selasa', 'ሠላሳ', 'sälasa', 'thirty', 'number', 'numbers'],
      ['ayn', 'ዓይን', 'ayn', 'eye', 'noun', 'body'],
      ['amet', 'ዓመት', 'amät', 'year', 'noun', 'everyday'],
      ['tsehay', 'ፀሐይ', "ts'ähay", 'sun', 'noun', 'nature'],
      ['qwanqwa', 'ቋንቋ', 'qwanqwa', 'language', 'noun', 'everyday'],
      ['gwadenya', 'ጓደኛ', 'gwadäñña', 'friend', 'noun', 'family'],
      ['gwaro', 'ጓሮ', 'gwaro', 'backyard', 'noun', 'places'],
    ],
  },
  tigrinya: {
    display_name: 'Tigrinya',
    prefix: 'ti',
    // KNOWN GAP: no production-quality Tigrinya TTS. "recorded" means
    // AudioService expects files at audio_path. See README §Audio.
    audio_strategy: 'recorded',
    tts_locale: null,
    tier1Lessons: 2,
    // Tigrinya keeps ሐ (ḥ), ዐ (ʿ), ኸ (x) and ቐ (qh) as distinct, common
    // sounds, so they're taught much earlier than in Amharic.
    roman: {
      h: 'h', l: 'l', hx: 'ḥ', m: 'm', r: 'r', s: 's', sh: 'sh', q: 'q', qh: 'qh', b: 'b', v: 'v',
      t: 't', ch: 'ch', n: 'n', ny: 'ñ', "'": '', k: 'k', kh: 'x', w: 'w', A: 'ʿ', z: 'z', zh: 'zh',
      y: 'y', d: 'd', j: 'j', g: 'g', tx: "t'", chx: "ch'", px: "p'", ts: "ts'", tsx: "ts'", f: 'f',
      p: 'p',
    },
    plan: [
      ['l'], ['m'], ['s'], ['b'], ['t'], 'checkpoint',
      ["'"], ['n'], ['r'], 'checkpoint',
      ['d'], ['w'], ['h'], ['hx'], 'checkpoint',
      ['k'], ['y'], ['A'], 'checkpoint',
      ['g'], ['q', 'qh'], ['kh'], 'checkpoint',
      ['f'], ['z'], ['tx'], 'checkpoint',
      ['sh'], ['j'], ['ch', 'ny'], 'checkpoint',
      ['chx'], ['ts'], ['tsx'], ['p', 'px'], ['v', 'zh'], 'checkpoint',
      ['lwa'], ['kwa'], 'checkpoint-all',
    ],
    words: [
      ['selam', 'ሰላም', 'sälam', 'hello / peace', 'greeting', 'everyday'],
      ['may', 'ማይ', 'may', 'water', 'noun', 'nature'],
      ['adde', 'ኣደ', 'addä', 'mother', 'noun', 'family'],
      ['abbo', 'ኣቦ', 'abbo', 'father', 'noun', 'family'],
      ['lebbi', 'ልቢ', 'ləbbi', 'heart', 'noun', 'body'],
      ['bani', 'ባኒ', 'bani', 'bread', 'noun', 'food'],
      ['seb', 'ሰብ', 'säb', 'person', 'noun', 'family'],
      ['dem', 'ደም', 'däm', 'blood', 'noun', 'body'],
      ['anbesa', 'ኣንበሳ', 'anbäsa', 'lion', 'noun', 'animals'],
      ['nehbi', 'ንህቢ', 'nəhbi', 'bee', 'noun', 'animals'],
      ['temen', 'ተመን', 'tämän', 'snake', 'noun', 'animals'],
      ['adi', 'ዓዲ', 'ʿaddi', 'village / homeland', 'noun', 'places'],
      ['lam', 'ላም', 'lam', 'cow', 'noun', 'animals'],
      ['sem', 'ስም', 'səm', 'name', 'noun', 'everyday'],
      ['selaste', 'ሰለስተ', 'sälästä', 'three', 'number', 'numbers'],
      ['om', 'ኦም', 'om', 'tree', 'noun', 'nature'],
      ['asnan', 'ኣስናን', 'asnan', 'teeth', 'noun', 'body'],
      ['bun', 'ቡን', 'bun', 'coffee', 'noun', 'food'],
      ['resi', 'ርእሲ', 'rəʾsi', 'head', 'noun', 'body'],
      ['id', 'ኢድ', 'id', 'hand', 'noun', 'body'],
      ['demmu', 'ድሙ', 'dəmmu', 'cat', 'noun', 'animals'],
      ['sedra', 'ስድራ', 'sədra', 'family', 'noun', 'family'],
      ['wedi', 'ወዲ', 'wädi', 'boy / son', 'noun', 'family'],
      ['mamher', 'መምህር', 'mämhər', 'teacher', 'noun', 'family'],
      ['berhan', 'ብርሃን', 'bərhan', 'light', 'noun', 'nature'],
      ['hade', 'ሓደ', 'ḥadä', 'one', 'number', 'numbers'],
      ['hawe', 'ሓወ', 'ḥawä', 'brother', 'noun', 'family'],
      ['hawi', 'ሓዊ', 'ḥawi', 'fire', 'noun', 'nature'],
      ['ketema', 'ከተማ', 'kätäma', 'city', 'noun', 'places'],
      ['kelte', 'ክልተ', 'kəltä', 'two', 'number', 'numbers'],
      ['mekina', 'መኪና', 'mäkina', 'car', 'noun', 'places'],
      ['kelbi', 'ከልቢ', 'kälbi', 'dog', 'noun', 'animals'],
      ['semay', 'ሰማይ', 'sämay', 'sky', 'noun', 'nature'],
      ['leyti', 'ለይቲ', 'läyti', 'night', 'noun', 'everyday'],
      ['temharay', 'ተምሃራይ', 'tämharay', 'student', 'noun', 'family'],
      ['sebeyti', 'ሰበይቲ', 'säbäyti', 'woman', 'noun', 'family'],
      ['asa', 'ዓሳ', 'ʿasa', 'fish', 'noun', 'animals'],
      ['ayni', 'ዓይኒ', 'ʿayni', 'eye', 'noun', 'body'],
      ['aserte', 'ዓሰርተ', 'ʿasärtä', 'ten', 'number', 'numbers'],
      ['mealti', 'መዓልቲ', 'mäʿalti', 'day', 'noun', 'everyday'],
      ['arbate', 'ኣርባዕተ', 'arbaʿtä', 'four', 'number', 'numbers'],
      ['arki', 'ዓርኪ', 'ʿarki', 'friend', 'noun', 'family'],
      ['hager', 'ሃገር', 'hagär', 'country', 'noun', 'places'],
      ['adgi', 'ኣድጊ', 'adgi', 'donkey', 'noun', 'animals'],
      ['sega', 'ስጋ', 'səga', 'meat', 'noun', 'food'],
      ['begie', 'በጊዕ', 'bägiʿ', 'sheep', 'noun', 'animals'],
      ['qeyeh', 'ቐይሕ', 'qhäyəḥ', 'red', 'noun', 'everyday'],
      ['qolea', 'ቆልዓ', 'qolʿa', 'child', 'noun', 'family'],
      ['kokob', 'ኮኾብ', 'koxob', 'star', 'noun', 'nature'],
      ['feres', 'ፈረስ', 'färäs', 'horse', 'noun', 'animals'],
      ['af', 'ኣፍ', 'af', 'mouth', 'noun', 'body'],
      ['hafti', 'ሓፍቲ', 'ḥafti', 'sister', 'noun', 'family'],
      ['feqri', 'ፍቕሪ', 'fəqhri', 'love', 'noun', 'everyday'],
      ['geza', 'ገዛ', 'gäza', 'house', 'noun', 'places'],
      ['ruz', 'ሩዝ', 'ruz', 'rice', 'noun', 'food'],
      ['zenab', 'ዝናብ', 'zənab', 'rain', 'noun', 'nature'],
      ['genzeb', 'ገንዘብ', 'gänzäb', 'money', 'noun', 'everyday'],
      ['zemed', 'ዘመድ', 'zämäd', 'relative', 'noun', 'family'],
      ['ezni', 'እዝኒ', 'əzni', 'ear', 'noun', 'body'],
      ['tena', 'ጥዕና', "t'əʿna", 'health', 'noun', 'everyday'],
      ['shahi', 'ሻሂ', 'shahi', 'tea', 'noun', 'food'],
      ['shekor', 'ሽኮር', 'shəkkor', 'sugar', 'noun', 'food'],
      ['hamushte', 'ሓሙሽተ', 'ḥamushtä', 'five', 'number', 'numbers'],
      ['jebena', 'ጀበና', 'jäbäna', 'coffee pot', 'noun', 'food'],
      ['tigrinya', 'ትግርኛ', 'təgrəñña', 'Tigrinya (language)', 'noun', 'everyday'],
      ['chew', 'ጨው', "ch'äw", 'salt', 'noun', 'food'],
      ['chama', 'ጫማ', "ch'amma", 'shoe', 'noun', 'everyday'],
      ['tseba', 'ጸባ', "ts'äba", 'milk', 'noun', 'food'],
      ['tsehay', 'ጸሓይ', "ts'äḥay", 'sun', 'noun', 'nature'],
      ['tselim', 'ጸሊም', "ts'älim", 'black', 'noun', 'everyday'],
      ['tsada', 'ጻዕዳ', "ts'aʿda", 'white', 'noun', 'everyday'],
      ['tseguri', 'ጸጉሪ', "ts'äguri", 'hair', 'noun', 'body'],
      ['maetso', 'ማዕጾ', "maʿts'o", 'door', 'noun', 'places'],
      ['edaga', 'ዕዳጋ', 'ʿədaga', 'market', 'noun', 'places'],
      ['tselot', 'ጸሎት', "ts'älot", 'prayer', 'noun', 'everyday'],
      ['pasta', 'ፓስታ', 'pasta', 'pasta', 'noun', 'food'],
      ['terepeza', 'ጠረጴዛ', "t'äräp'eza", 'table', 'noun', 'places'],
      ['television', 'ቴሌቪዥን', 'televizhən', 'television', 'noun', 'everyday'],
      ['hakim', 'ሓኪም', 'ḥakim', 'doctor', 'noun', 'family'],
      ['werhi', 'ወርሒ', 'wärḥi', 'moon', 'noun', 'nature'],
      ['qwanqwa', 'ቋንቋ', 'qwanqwa', 'language', 'noun', 'everyday'],
      ['gwal', 'ጓል', 'gwal', 'girl / daughter', 'noun', 'family'],
    ],
  },
};

// Exercise mixes per lesson kind (merged over the engine defaults).
const WEIGHTS = {
  intro: { listen_select: 4, match_pairs: 3, trace_glyph: 2, multiple_choice: 1 },
  letters: { listen_select: 4, match_pairs: 2, trace_glyph: 1, listen_write: 2, fill_blank: 2, multiple_choice: 1 },
  checkpoint: { listen_select: 3, listen_write: 3, fill_blank: 3, match_pairs: 1, trace_glyph: 0, multiple_choice: 1 },
  theme: { listen_select: 3, fill_blank: 3, multiple_choice: 2, listen_write: 1, match_pairs: 0, trace_glyph: 0 },
  dictation: { listen_write: 5, fill_blank: 1, listen_select: 1, multiple_choice: 0, match_pairs: 0, trace_glyph: 0 },
  final: { listen_select: 2, listen_write: 3, fill_blank: 3, multiple_choice: 1, match_pairs: 1, trace_glyph: 0 },
};

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
  throw new Error(msg);
}

function buildFamilies(courseId, c) {
  const used = [...new Set(c.plan.filter(Array.isArray).flat())];
  // keyboard/chart order: traditional ሀ ለ ሐ … order, -wa groups last
  const ordered = [
    ...Object.keys(FAMILY_BASES).filter((k) => used.includes(k)),
    ...Object.keys(WA_GROUPS).filter((k) => used.includes(k)),
  ];
  for (const k of used) if (!ordered.includes(k)) fail(`${courseId}: unknown family "${k}" in plan`);

  return ordered.map((key) => {
    if (WA_GROUPS[key]) {
      const g = WA_GROUPS[key];
      return { key, label: g.label, forms: g.forms, romanized: g.romanized };
    }
    const consonant = c.roman[key];
    if (consonant == null) fail(`${courseId}: no romanization for family "${key}"`);
    const forms = ORDER_VOWELS.map((_, i) => cp(FAMILY_BASES[key] + i));
    const romanized = ORDER_VOWELS.map((v) => consonant + v);
    return { key, label: consonant || romanized[3], forms, romanized };
  });
}

function buildCourse(courseId) {
  const c = COURSES[courseId];
  const P = c.prefix;
  const families = buildFamilies(courseId, c);
  const familyByKey = new Map(families.map((f) => [f.key, f]));

  // ---------- items ----------
  const items = [];
  const familyOfGlyph = new Map();
  for (const fam of families) {
    fam.forms.forEach((glyph, i) => {
      if (familyOfGlyph.has(glyph)) fail(`${courseId}: glyph ${glyph} appears in two families`);
      familyOfGlyph.set(glyph, fam.key);
      items.push({
        id: `${P}_g_${slug(fam.key)}${i + 1}`,
        glyph,
        transliteration: fam.romanized[i],
        audio_path: `${P}/g_${slug(fam.key)}${i + 1}.mp3`,
        english_gloss: null,
        grammar_tag: 'glyph',
        difficulty_tier: 2,
        family_group: fam.key,
        order: i + 1,
      });
    });
  }

  const wordIds = new Set();
  const words = c.words.map(([id, glyph, transliteration, gloss, tag, theme]) => {
    const wid = `${P}_w_${id}`;
    if (wordIds.has(wid)) fail(`${courseId}: duplicate word id ${wid}`);
    wordIds.add(wid);
    if (!THEME_TITLES[theme]) fail(`${courseId}: word ${id} has unknown theme "${theme}"`);
    const fams = new Set();
    for (const ch of glyph) {
      const f = familyOfGlyph.get(ch);
      if (!f) fail(`${courseId}: word ${id} (${glyph}) uses ${ch}, which no family in this course teaches`);
      fams.add(f);
    }
    items.push({
      id: wid,
      glyph,
      transliteration,
      audio_path: `${P}/w_${id}.mp3`,
      english_gloss: gloss,
      grammar_tag: tag,
      difficulty_tier: 1,
      family_group: null,
    });
    return { id: wid, glyph, theme, families: fams };
  });

  const glyphIds = (keys) =>
    items.filter((it) => it.grammar_tag === 'glyph' && keys.includes(it.family_group)).map((it) => it.id);

  // ---------- letter lessons + checkpoints ----------
  const lessons = [];
  const push = (lesson) => lessons.push({ id: `${P}_l${lessons.length + 1}`, ...lesson });
  const tierFor = () => (lessons.length < c.tier1Lessons ? 1 : 2);

  const taught = new Set();
  const placed = new Set(); // word ids already introduced
  let pending = []; // decodable, not yet introduced (overflow)
  let sinceCheckpointFamilies = [];
  let sinceCheckpointWords = [];
  let checkpointNo = 0;
  const introduced = []; // word ids in order of introduction

  for (const step of c.plan) {
    if (step === 'checkpoint' || step === 'checkpoint-all') {
      checkpointNo += 1;
      const newWords = [...sinceCheckpointWords, ...pending.map((w) => w.id)];
      pending.forEach((w) => {
        placed.add(w.id);
        introduced.push(w.id);
      });
      pending = [];
      const older = introduced.filter((id) => !newWords.includes(id)).slice(-3);
      const all = step === 'checkpoint-all';
      const famKeys = all ? [...taught] : sinceCheckpointFamilies;
      const bases = famKeys.map((k) => familyByKey.get(k).forms[0]);
      push({
        title: all ? 'Checkpoint: every letter' : `Checkpoint ${checkpointNo}`,
        subtitle: all ? 'Mixed review of the whole script' : `Review ${bases.join(' ')} + words`,
        tier: tierFor(),
        item_ids: [...glyphIds(famKeys), ...newWords, ...older],
        exercise_weights: WEIGHTS.checkpoint,
        length: 12,
      });
      sinceCheckpointFamilies = [];
      sinceCheckpointWords = [];
      continue;
    }

    // letter lesson
    const fams = step.map((k) => familyByKey.get(k));
    const soundAlikes = fams
      .map((f) => families.find((o) => taught.has(o.key) && o.romanized.join() === f.romanized.join()))
      .filter(Boolean);
    step.forEach((k) => taught.add(k));

    const newlyDecodable = words
      .filter((w) => !placed.has(w.id) && !pending.includes(w) && [...w.families].every((f) => taught.has(f)))
      .sort((a, b) => [...a.glyph].length - [...b.glyph].length); // shorter = easier first
    pending.push(...newlyDecodable);
    const take = pending.splice(0, MAX_WORDS_PER_LETTER_LESSON);
    take.forEach((w) => {
      placed.add(w.id);
      introduced.push(w.id);
    });

    const bases = fams.map((f) => f.forms[0]).join(' · ');
    const isWa = fams.every((f) => WA_GROUPS[f.key]);
    const first = lessons.length === 0;
    let subtitle;
    if (first) subtitle = 'One consonant, seven vowel sounds';
    else if (soundAlikes.length) {
      const like = [...new Set(soundAlikes.map((f) => f.forms[0]))].join(' · ');
      subtitle = `Same sound as ${like} — different letter`;
    }
    else if (take.length) subtitle = `New words: ${take.map((w) => w.glyph).join(' · ')}`;
    else subtitle = fams.map((f) => f.romanized.join(' ')).join(' / ');

    push({
      title: first ? `How fidel works · ${bases}` : isWa ? `Letters: ${fams[0].forms.slice(0, 3).join(' ')} …` : `Letters: ${bases}`,
      subtitle,
      tier: tierFor(),
      item_ids: [...glyphIds(step), ...take.map((w) => w.id)],
      introduces_families: step,
      exercise_weights: lessons.length < c.tier1Lessons ? WEIGHTS.intro : WEIGHTS.letters,
      length: 10 + take.length,
    });
    sinceCheckpointFamilies.push(...step);
    sinceCheckpointWords.push(...take.map((w) => w.id));
  }

  const undecodable = words.filter((w) => !placed.has(w.id));
  if (undecodable.length) fail(`${courseId}: words never reached by the plan: ${undecodable.map((w) => w.glyph).join(' ')}`);

  // ---------- fidel-first reading, dictation, final ----------
  for (const theme of THEME_ORDER) {
    const themed = words.filter((w) => w.theme === theme);
    if (!themed.length) continue;
    push({
      title: `Read: ${THEME_TITLES[theme]}`,
      subtitle: themed.slice(0, 3).map((w) => w.glyph).join(' · '),
      tier: 3,
      item_ids: themed.map((w) => w.id),
      exercise_weights: WEIGHTS.theme,
      length: 12,
    });
  }

  const dictationCount = TOTAL_LESSONS - lessons.length - 1;
  if (dictationCount < 1) fail(`${courseId}: plan is too long — ${lessons.length + 1} lessons before dictation`);
  const byLength = [...words].sort((a, b) => [...a.glyph].length - [...b.glyph].length);
  for (let i = 0; i < dictationCount; i++) {
    const chunk = byLength.filter((_, j) => Math.floor((j * dictationCount) / byLength.length) === i);
    push({
      title: dictationCount > 1 ? `Write what you hear ${i + 1}` : 'Write what you hear',
      subtitle: i === 0 ? 'Dictation — short words' : 'Dictation — longer words',
      tier: 3,
      item_ids: chunk.map((w) => w.id),
      exercise_weights: WEIGHTS.dictation,
      length: 10,
    });
  }

  push({
    title: 'Final review',
    subtitle: 'Everything, fidel-first',
    tier: 3,
    item_ids: words.map((w) => w.id),
    exercise_weights: WEIGHTS.final,
    length: 15,
  });

  // ---------- validation ----------
  if (lessons.length !== TOTAL_LESSONS) fail(`${courseId}: ${lessons.length} lessons, expected ${TOTAL_LESSONS}`);
  const itemIds = new Set(items.map((i) => i.id));
  const known = new Set();
  for (const l of lessons) {
    for (const k of l.introduces_families ?? []) known.add(k);
    for (const id of l.item_ids) {
      if (!itemIds.has(id)) fail(`${courseId}: ${l.id} references missing item ${id}`);
      const w = words.find((x) => x.id === id);
      if (w && l.tier < 3 && ![...w.families].every((f) => known.has(f))) {
        fail(`${courseId}: ${l.id} shows ${w.glyph} before all its letters are taught`);
      }
    }
    if (!l.item_ids.length) fail(`${courseId}: ${l.id} has no items`);
  }

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
  const wordCount = course.items.filter((i) => i.grammar_tag !== 'glyph').length;
  console.log(
    `✓ ${courseId}: ${course.families.length} families, ${wordCount} words, ${course.items.length} items, ${course.lessons.length} lessons -> ${out}`
  );
}
