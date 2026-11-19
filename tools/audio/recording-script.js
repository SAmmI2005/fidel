#!/usr/bin/env node
/**
 * Generates a printable reading script for a native-speaker recording session.
 *
 *   node tools/audio/recording-script.js ti
 *
 * Writes recordings/<code>/script.html — open it in a browser, print it or
 * read from the screen.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, loadCourse, buildTakes } = require('./takes');

const code = process.argv[2] || 'ti';
const course = loadCourse(code);
const takes = buildTakes(course);
const total = takes.reduce((n, t) => n + t.items.length, 0);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const card = (t) => `
  <section class="take ${t.kind}">
    <header>
      <span class="num">Take ${t.number}</span>
      <span class="title">${esc(t.title)}</span>
      <span class="save">save as <b>${t.number}</b></span>
    </header>
    <ol>
      ${t.items
        .map(
          (i) => `<li><span class="g">${esc(i.glyph)}</span><span class="t">${esc(i.transliteration)}</span>${
            i.gloss ? `<span class="e">${esc(i.gloss)}</span>` : ''
          }</li>`,
        )
        .join('\n      ')}
    </ol>
  </section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(course.name)} recording script</title>
<style>
  :root { --ink:#1d1b18; --muted:#6b655c; --line:#e3ddd2; --bg:#fbf8f2; --card:#fff; --accent:#b4532a; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 64px; background: var(--bg); color: var(--ink);
         font: 16px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; }
  .howto { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 20px; margin-bottom: 28px; }
  .howto h2 { font-size: 17px; margin: 0 0 8px; }
  .howto ol { margin: 0; padding-left: 20px; }
  .howto li { margin: 4px 0; }
  .take { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px 18px;
          margin-bottom: 16px; break-inside: avoid; }
  .take header { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; margin-bottom: 10px; }
  .num { font-weight: 700; color: var(--accent); }
  .title { font-weight: 600; }
  .save { margin-left: auto; color: var(--muted); font-size: 14px; }
  .take ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .letters ol { grid-template-columns: repeat(7, 1fr); }
  .words ol { grid-template-columns: repeat(4, 1fr); }
  .take li { display: flex; flex-direction: column; align-items: center; text-align: center;
             padding: 8px 4px; border-radius: 8px; background: var(--bg); }
  .g { font-size: 40px; line-height: 1.2; font-family: "Noto Sans Ethiopic", "Kefa", "Abyssinica SIL", serif; }
  .words .g { font-size: 30px; }
  .t { color: var(--muted); font-size: 14px; }
  .e { color: var(--muted); font-size: 12px; font-style: italic; }
  @media (max-width: 600px) {
    .letters ol { grid-template-columns: repeat(4, 1fr); }
    .words ol { grid-template-columns: repeat(2, 1fr); }
  }
  @media print {
    body { background: #fff; padding: 0; }
    .take, .howto { border-color: #bbb; }
  }
</style>
</head>
<body>
<main>
  <h1>${esc(course.name)} recording script</h1>
  <p class="sub">${takes.length} takes · ${total} sounds and words · about 30–45 minutes</p>

  <div class="howto">
    <h2>How to record</h2>
    <ol>
      <li>Quiet room with soft things around (a closet full of clothes is great). Fans and AC off, phone in airplane mode.</li>
      <li>Use <b>Voice Memos</b>. Hold the phone 15–20 cm from your mouth and keep that distance the whole time.</li>
      <li>One recording per take. Read left to right, each sound <b>once</b>, then pause about <b>2 seconds</b> before the next.</li>
      <li>Say each sound clearly, the way you'd teach it, not stretched out. For letters, say just the sound (ለ = “lä”), not the letter's name.</li>
      <li>Made a mistake? Stop, delete that recording and redo the whole take. They're short.</li>
      <li>Rename each recording to its take number (<b>1</b>, <b>2</b>, … ${takes.length}). Order doesn't matter, just the number.</li>
      <li>Send all the recordings to the Mac (AirDrop, or Share → Save to Files) and put them in <code>recordings/${code}/raw/</code>.</li>
    </ol>
  </div>

  ${takes.map(card).join('\n')}
</main>
</body>
</html>
`;

const out = path.join(ROOT, 'recordings', code, 'script.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'recordings', code, 'raw'), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${takes.length} takes, ${total} clips → ${path.relative(ROOT, out)}`);
