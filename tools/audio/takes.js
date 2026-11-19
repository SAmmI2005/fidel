/**
 * Shared definition of the recording "takes" for a course.
 *
 * A take is one continuous recording: the speaker reads a short list of
 * sounds with a pause after each. One take per letter family (7 sounds),
 * then the words in groups of WORDS_PER_TAKE. Keeping takes short means a
 * mistake costs a few seconds to redo, and the splitter can verify that it
 * found exactly the expected number of clips.
 *
 * Take numbers are stable as long as course.json's families/items don't
 * change order, so re-running the tools on the same recordings is safe.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORDS_PER_TAKE = 8;

const COURSES = {
  ti: { dir: 'tigrinya', name: 'Tigrinya' },
  am: { dir: 'amharic', name: 'Amharic' },
};

function loadCourse(code) {
  const c = COURSES[code];
  if (!c) {
    console.error(`Unknown course "${code}". Use one of: ${Object.keys(COURSES).join(', ')}`);
    process.exit(1);
  }
  const json = require(path.join(ROOT, 'content', c.dir, 'course.json'));
  return { code, ...c, json };
}

/** Returns [{ number, id, title, items: [{ id, glyph, transliteration, gloss, audio_path }] }] */
function buildTakes(course) {
  const items = course.json.items;
  const takes = [];
  const pick = (i) => ({
    id: i.id,
    glyph: i.glyph,
    transliteration: i.transliteration,
    gloss: i.english_gloss,
    audio_path: i.audio_path,
  });

  for (const fam of course.json.families) {
    const glyphs = items
      .filter((i) => i.grammar_tag === 'glyph' && i.family_group === fam.key)
      .sort((a, b) => a.order - b.order);
    if (glyphs.length === 0) continue;
    takes.push({
      kind: 'letters',
      title: fam.label === '-wa forms' ? `-wa forms (${glyphs[0].glyph} …)` : `${glyphs[0].glyph} family`,
      items: glyphs.map(pick),
    });
  }

  const words = items.filter((i) => i.grammar_tag !== 'glyph');
  for (let k = 0; k < words.length; k += WORDS_PER_TAKE) {
    const chunk = words.slice(k, k + WORDS_PER_TAKE);
    takes.push({
      kind: 'words',
      title: `Words ${k + 1}–${k + chunk.length}`,
      items: chunk.map(pick),
    });
  }

  return takes.map((t, idx) => ({ ...t, number: idx + 1, id: String(idx + 1).padStart(2, '0') }));
}

module.exports = { ROOT, COURSES, loadCourse, buildTakes };
