/**
 * SM-2-lite spaced repetition over ContentItem ids.
 * Every item answered in any exercise feeds this; the Review screen and the
 * exercise engine both pull from dueItems().
 */
export interface SrsCard {
  itemId: string;
  ease: number;        // 1.3 .. 2.8
  intervalDays: number;
  dueAt: number;       // epoch ms
  lapses: number;
  reps: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function newCard(itemId: string, now = Date.now()): SrsCard {
  return { itemId, ease: 2.3, intervalDays: 0, dueAt: now, lapses: 0, reps: 0 };
}

/** grade: 0 = wrong, 1 = correct-with-hint (e.g. tapped the tier-3 reveal), 2 = correct */
export function review(card: SrsCard, grade: 0 | 1 | 2, now = Date.now()): SrsCard {
  const c = { ...card, reps: card.reps + 1 };
  if (grade === 0) {
    c.lapses += 1;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.intervalDays = 0;
    c.dueAt = now + 10 * 60 * 1000; // resurface within the session / 10 min
    return c;
  }
  // A correct answer before the card is due (e.g. the same item appearing twice
  // in one lesson) proves nothing about long-term recall: don't grow the interval.
  if (card.dueAt > now) return c;
  c.ease = Math.min(2.8, c.ease + (grade === 2 ? 0.05 : -0.05));
  c.intervalDays = c.intervalDays === 0 ? (grade === 2 ? 1 : 0.5) : c.intervalDays * c.ease;
  c.dueAt = now + c.intervalDays * DAY;
  return c;
}

export function dueItems(cards: Record<string, SrsCard>, now = Date.now(), limit = 20): string[] {
  return Object.values(cards)
    .filter((c) => c.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit)
    .map((c) => c.itemId);
}
