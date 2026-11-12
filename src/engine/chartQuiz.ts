/**
 * Fidel chart quizzes — pure logic, no UI.
 *
 *  - 'type':   show a fidel letter → learner types its Latin spelling
 *  - 'choose': show a Latin spelling → learner picks the fidel from 4
 *
 * Typed answers follow the chart's own convention (ä u i a e ə o) with a few
 * forgiving alternates. What is deliberately NOT forgiven: ä vs a (1st vs 4th
 * order), since telling ሀ from ሃ is the skill being tested.
 */
import type { ChartCell, ChartRow } from '../content/fidelChart';

export type QuizMode = 'type' | 'choose';

export interface QuizQuestion {
  cell: ChartCell;
  /** 'choose' mode only: 4 glyph options, including the answer. */
  choices?: ChartCell[];
}

export const QUIZ_LENGTH = 10;

/** Accepted spellings for each vowel order's vowel (index 0 = 1st order). */
const VOWEL_ALTERNATES: string[][] = [
  ['ä'], // 1st — ä only; plain "a" is the 4th order
  ['u'],
  ['i'],
  ['a'],
  ['e', 'é', 'ie'], // 5th
  ['ə', ''], // 6th — often written as the bare consonant
  ['o'],
];

/**
 * Normalize typed or stored Latin: lowercase, unify apostrophes (iOS turns '
 * into ’), drop the ʿ/ʾ marks, and collapse consonant dots/accents that mark
 * sounds modern speakers pronounce identically (ḥ/ḫ → h, ś/ṣ → s).
 * Vowels are left alone so ä ≠ a and ə ≠ e.
 */
export function normalizeLatin(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[ʿʾ]/g, '')
    .replace(/ǝ/g, 'ə') // turned-e lookalike
    .replace(/[ḥḫ]/g, 'h')
    .replace(/[śṣ]/g, 's');
}

/** Every spelling accepted for a letter. */
export function acceptedAnswers(cell: ChartCell): string[] {
  const roman = normalizeLatin(cell.roman);
  const accepted = new Set<string>([roman]);
  const vowel = roman.slice(-1);
  const vowelAlts = VOWEL_ALTERNATES[cell.order - 1];
  if (vowelAlts?.includes(vowel)) {
    const consonant = roman.slice(0, -1);
    const consonantAlts = [consonant];
    if (consonant.includes('ñ')) consonantAlts.push(consonant.replace(/ñ/g, 'ny'));
    for (const c of consonantAlts) for (const v of vowelAlts) accepted.add(c + v);
  }
  accepted.delete(''); // the bare 6th order of አ would otherwise be empty
  return [...accepted];
}

export function isTypedAnswerCorrect(cell: ChartCell, typed: string): boolean {
  const t = normalizeLatin(typed);
  return t.length > 0 && acceptedAnswers(cell).includes(t);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Four options for a 'choose' question. Distractors are the confusable ones:
 * other vowel orders of the same consonant, then the same vowel order on other
 * consonants. Letters whose Latin spelling is the same as the answer's (e.g.
 * ሀ/ሐ both "hä" once dots are dropped) are excluded so every question has
 * exactly one right answer.
 */
function choicesFor(target: ChartCell, row: ChartRow, rows: ChartRow[]): ChartCell[] {
  const targetSpelling = normalizeLatin(target.roman);
  const ok = (c: ChartCell) => c.glyph !== target.glyph && normalizeLatin(c.roman) !== targetSpelling;

  const sameFamily = shuffle(row.cells.filter(ok)).slice(0, 2);
  const sameOrder = shuffle(
    rows.filter((r) => r !== row).map((r) => r.cells[target.order - 1]).filter(ok)
  );
  const picked: ChartCell[] = [...sameFamily];
  for (const c of sameOrder) {
    if (picked.length >= 3) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return shuffle([target, ...picked]);
}

export function buildQuiz(rows: ChartRow[], mode: QuizMode, length = QUIZ_LENGTH): QuizQuestion[] {
  const all = rows.flatMap((row) => row.cells.map((cell) => ({ cell, row })));
  return shuffle(all)
    .slice(0, length)
    .map(({ cell, row }) => (mode === 'choose' ? { cell, choices: choicesFor(cell, row, rows) } : { cell }));
}
