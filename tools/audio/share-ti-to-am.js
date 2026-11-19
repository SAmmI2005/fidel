#!/usr/bin/env node
/**
 * Reuses the Tigrinya letter recordings for the Amharic course wherever the
 * two languages pronounce a family the same way.
 *
 *   node tools/audio/share-ti-to-am.js
 *
 * Re-run after recording more Tigrinya families: any family that now has
 * Tigrinya clips is picked up automatically. Existing Amharic clips are
 * overwritten (they all come from this script).
 *
 * Amharic differences handled here:
 *  - Tigrinya's first order leans toward "e" (መ = "me"), but Amharic's
 *    sounds like the fourth (መ = ማ = "ma"), so every Amharic order-1 letter
 *    uses the Tigrinya order-4 clip.
 *  - ሐ and ኀ are said like ሀ, ሠ like ሰ, ዐ like አ. Tigrinya keeps ሐ and ዐ
 *    as throat sounds, so their Amharic clips come from the ሀ / ሰ / አ takes.
 *  - ኸ (kh) is skipped: Amharic usage differs, so it stays on TTS.
 *  - ቐ (qh) does not exist in Amharic.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./takes');
const { buildManifest } = require('./build-manifest');

/** Amharic family key → Tigrinya family key whose recordings it reuses. */
const SOURCE = { hx: 'h', hh: 'h', sx: 's', A: "'" };
/** Amharic families that must not reuse Tigrinya audio. */
const SKIP = new Set(['kh']);

const load = (dir) => require(path.join(ROOT, 'content', dir, 'course.json'));
const glyphs = (c) => c.items.filter((i) => i.grammar_tag === 'glyph');

const ti = new Map(glyphs(load('tigrinya')).map((i) => [`${i.family_group}|${i.order}`, i]));
const audioDir = path.join(ROOT, 'assets', 'audio');

const copied = new Map();
const missing = new Set();
for (const item of glyphs(load('amharic'))) {
  const fam = item.family_group;
  if (SKIP.has(fam)) continue;
  const srcFam = SOURCE[fam] ?? fam;
  const srcOrder = item.order === 1 ? 4 : item.order;
  const src = ti.get(`${srcFam}|${srcOrder}`);
  const srcFile = src && path.join(audioDir, src.audio_path);
  if (!srcFile || !fs.existsSync(srcFile)) {
    missing.add(fam);
    continue;
  }
  const dest = path.join(audioDir, item.audio_path);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcFile, dest);
  const label = `${fam}${srcFam !== fam ? ` ← ti ${srcFam}` : ''}`;
  copied.set(label, (copied.get(label) ?? 0) + 1);
}

const total = [...copied.values()].reduce((a, b) => a + b, 0);
console.log(`Copied ${total} clips into assets/audio/am/ from ${copied.size} families:`);
console.log('  ' + [...copied].map(([k, n]) => `${k} (${n})`).join(', '));
if (missing.size) console.log(`No Tigrinya recording yet (stay on TTS): ${[...missing].join(', ')}`);
console.log(`${buildManifest()} recording(s) in the bundled manifest`);
