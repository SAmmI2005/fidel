#!/usr/bin/env node
/**
 * Splits raw take recordings into one clip per item and adds them to the app.
 *
 *   node tools/audio/split-takes.js ti                 # every take in recordings/ti/raw/
 *   node tools/audio/split-takes.js ti --take 7        # just take 7
 *   node tools/audio/split-takes.js ti --take 7 --noise -30 --gap 0.4   # manual tuning
 *
 * Raw files: recordings/<code>/raw/<number>.<audio or video ext>  (e.g. "7.m4a", "7.mov",
 * "07 h family.m4a" — only the leading number matters).
 *
 * For each take it finds the pauses, and only writes clips when it finds
 * exactly as many sounds as the take expects; otherwise it reports the take so
 * it can be re-recorded or re-run with --noise/--gap. Clips are trimmed,
 * cleaned (rumble filter, short fades), loudness-normalised, and written as
 * mono mp3 to assets/audio/<audio_path>. Then it rebuilds the bundled-audio
 * manifest and writes recordings/<code>/review.html for listening checks.
 *
 * Requires ffmpeg (brew install ffmpeg).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, loadCourse, buildTakes } = require('./takes');
const { buildManifest } = require('./build-manifest');

// ---- args -----------------------------------------------------------------
const args = process.argv.slice(2);
const code = args[0] && !args[0].startsWith('--') ? args[0] : 'ti';
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const onlyTake = flag('take') ? Number(flag('take')) : null;
const manualNoise = flag('noise') ? Number(flag('noise')) : null;
const manualGap = flag('gap') ? Number(flag('gap')) : null;

// ---- setup ----------------------------------------------------------------
if (spawnSync('ffmpeg', ['-version']).status !== 0) {
  console.error('ffmpeg not found. Install it with:  brew install ffmpeg');
  process.exit(1);
}

const course = loadCourse(code);
const takes = buildTakes(course);
const rawDir = path.join(ROOT, 'recordings', code, 'raw');
const outRoot = path.join(ROOT, 'assets', 'audio');
const AUDIO_EXT = /\.(m4a|mp3|wav|aac|caf|aiff?|flac|ogg|opus|mp4|mov|m4v|qta)$/i;

/** Sounds shorter than this are clicks/breaths, not speech. */
const MIN_SOUND = 0.12;
/** Silence kept before/after each clip. */
const PAD_BEFORE = 0.08;
const PAD_AFTER = 0.15;
/** Settings tried in order until one finds the expected number of sounds. */
const NOISE_LEVELS = [-35, -40, -30, -45, -50, -25];
const GAPS = [0.6, 0.45, 0.8, 1.0, 0.35];

// ---- ffmpeg helpers -------------------------------------------------------
function ff(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...argv], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(r.stderr.split('\n').slice(-6).join('\n'));
  return r.stderr;
}

function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
    encoding: 'utf8',
  });
  return Number(r.stdout.trim());
}

/** Non-silent [start, end] ranges in the file. */
function findSounds(file, noise, gap, total) {
  const log = ff(['-i', file, '-af', `highpass=f=80,silencedetect=noise=${noise}dB:d=${gap}`, '-f', 'null', '-']);
  const silences = [];
  let start = null;
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    if (e && start != null) {
      silences.push([start, Number(e[1])]);
      start = null;
    }
  }
  if (start != null) silences.push([start, total]); // trailing silence

  const sounds = [];
  let cursor = 0;
  for (const [s, e] of silences) {
    if (s > cursor) sounds.push([cursor, s]);
    cursor = e;
  }
  if (cursor < total) sounds.push([cursor, total]);
  return sounds.filter(([s, e]) => e - s >= MIN_SOUND);
}

function exportClip(file, start, end, dest) {
  const len = end - start;
  const fadeOut = Math.min(0.06, len / 4);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  ff([
    '-y',
    '-ss', start.toFixed(3),
    '-t', len.toFixed(3),
    '-i', file,
    '-af',
    [
      'highpass=f=80',
      'afade=t=in:d=0.02',
      `afade=t=out:st=${(len - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`,
      'loudnorm=I=-16:TP=-1.5:LRA=11',
    ].join(','),
    '-ar', '44100',
    '-ac', '1',
    '-c:a', 'libmp3lame',
    '-q:a', '4',
    dest,
  ]);
}

// ---- main -----------------------------------------------------------------
fs.mkdirSync(rawDir, { recursive: true });
const rawFiles = fs.readdirSync(rawDir).filter((f) => AUDIO_EXT.test(f));
const byNumber = new Map();
for (const f of rawFiles) {
  const m = f.match(/^\s*(?:take\s*)?(\d+)/i);
  if (!m) {
    console.warn(`  ? ignoring "${f}" (name must start with the take number)`);
    continue;
  }
  const n = Number(m[1]);
  if (byNumber.has(n)) console.warn(`  ? two files for take ${n}: "${byNumber.get(n)}" and "${f}" — using "${f}"`);
  byNumber.set(n, f);
}

const ok = [];
const problems = [];
const missing = [];

for (const take of takes) {
  if (onlyTake != null && take.number !== onlyTake) continue;
  const fname = byNumber.get(take.number);
  if (!fname) {
    missing.push(take);
    continue;
  }
  const file = path.join(rawDir, fname);
  const total = duration(file);
  const expected = take.items.length;

  let sounds = null;
  let tried = [];
  const noises = manualNoise != null ? [manualNoise] : NOISE_LEVELS;
  const gaps = manualGap != null ? [manualGap] : GAPS;
  search: for (const noise of noises) {
    for (const gap of gaps) {
      const found = findSounds(file, noise, gap, total);
      tried.push(found.length);
      if (found.length === expected) {
        sounds = found;
        break search;
      }
    }
  }

  if (!sounds) {
    const counts = [...new Set(tried)].sort((a, b) => a - b).join('/');
    problems.push(`Take ${take.number} (${take.title}, "${fname}"): expected ${expected} sounds, found ${counts}`);
    continue;
  }

  sounds.forEach(([s, e], k) => {
    const prevEnd = k > 0 ? sounds[k - 1][1] : 0;
    const nextStart = k < sounds.length - 1 ? sounds[k + 1][0] : total;
    const start = Math.max(prevEnd + (s - prevEnd) / 2, s - PAD_BEFORE, 0);
    const end = Math.min(e + (nextStart - e) / 2, e + PAD_AFTER, total);
    exportClip(file, start, end, path.join(outRoot, take.items[k].audio_path));
  });
  ok.push(take);
  console.log(`  ✓ take ${take.number} ${take.title}: ${expected} clips`);
}

// ---- report ---------------------------------------------------------------
const manifestCount = buildManifest();
writeReview();

console.log('');
console.log(`Done: ${ok.length} take(s) split. ${manifestCount} clip(s) now bundled in the app.`);
if (problems.length) {
  console.log('\nNeeds attention (nothing was written for these):');
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(
    '\n  Usually: a mistake or a cough (re-record the take), or pauses too short.\n' +
      '  You can also try: node tools/audio/split-takes.js ' + code + ' --take N --noise -30 --gap 0.4',
  );
}
if (onlyTake == null && missing.length) {
  console.log(`\nNot recorded yet: takes ${missing.map((t) => t.number).join(', ')}`);
}
console.log(`\nListen to the results: open recordings/${code}/review.html`);

function writeReview() {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const reviewPath = path.join(ROOT, 'recordings', code, 'review.html');
  const rows = takes
    .map((t) => {
      const cells = t.items
        .map((i) => {
          const abs = path.join(outRoot, i.audio_path);
          const has = fs.existsSync(abs);
          const rel = path.relative(path.dirname(reviewPath), abs).split(path.sep).join('/');
          return `<li class="${has ? '' : 'none'}" ${has ? `data-src="${esc(rel)}"` : ''}>
            <span class="g">${esc(i.glyph)}</span><span class="t">${esc(i.transliteration)}</span>
            ${has ? '' : '<span class="m">not recorded</span>'}</li>`;
        })
        .join('');
      return `<section><h2>Take ${t.number} · ${esc(t.title)}</h2><ol>${cells}</ol></section>`;
    })
    .join('\n');

  fs.writeFileSync(
    reviewPath,
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(course.name)} audio review</title>
<style>
  body { margin:0; padding:24px 16px 64px; background:#fbf8f2; color:#1d1b18; font:16px/1.5 -apple-system,system-ui,sans-serif; }
  main { max-width:860px; margin:0 auto; } h1 { margin:0 0 4px; } p { color:#6b655c; margin:0 0 20px; }
  section { background:#fff; border:1px solid #e3ddd2; border-radius:12px; padding:12px 16px 16px; margin-bottom:14px; }
  h2 { font-size:15px; margin:0 0 10px; }
  ol { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:8px; }
  li { display:flex; flex-direction:column; align-items:center; padding:8px 4px; border-radius:8px; background:#f3eee4; cursor:pointer; user-select:none; }
  li:hover { background:#ebe3d4; } li.playing { background:#f2d3c2; }
  li.none { opacity:.45; cursor:default; }
  .g { font-size:30px; line-height:1.25; } .t { font-size:13px; color:#6b655c; } .m { font-size:11px; color:#b4532a; }
</style></head><body><main>
<h1>${esc(course.name)} audio review</h1>
<p>Click a sound to hear it. Check that each one matches its letter. Space plays the next clip.</p>
${rows}
</main>
<script>
  const audio = new Audio(); let cur = null;
  const all = [...document.querySelectorAll('li[data-src]')];
  function play(li) { if (cur) cur.classList.remove('playing'); cur = li; li.classList.add('playing');
    audio.src = li.dataset.src; audio.play(); li.scrollIntoView({ block: 'nearest' }); }
  audio.onended = () => cur && cur.classList.remove('playing');
  all.forEach(li => li.addEventListener('click', () => play(li)));
  document.addEventListener('keydown', e => { if (e.code !== 'Space') return; e.preventDefault();
    const i = cur ? all.indexOf(cur) + 1 : 0; if (all[i]) play(all[i]); });
</script></body></html>`,
  );
}
