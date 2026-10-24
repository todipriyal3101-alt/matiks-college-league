// 30-second math duel: the question sequence and the scoring rules, shared by the browser (to play) and the
// server (to verify). Same seed → same questions, so the server can replay a round and score it itself.

export const DUEL_MS = 30_000;
/** Faster than this between two answers isn't a human typing. */
export const MIN_ANSWER_MS = 250;
/** Network/timer slack on the last answer. */
export const GRACE_MS = 1_500;
export const MAX_QUESTIONS = 120;

export type Question = { text: string; answer: number };
export type Answer = { i: number; a: number; t: number };

/** Small fast seeded PRNG (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The i-th question gets harder: single digits → two digits → tables → ×, ÷ and mixed. Answers are whole and ≥ 0. */
export function questions(seed: number, count = MAX_QUESTIONS): Question[] {
  const r = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const level = i < 4 ? 0 : i < 9 ? 1 : i < 15 ? 2 : i < 22 ? 3 : 4;
    const kind = int(0, 3);
    let q: Question;
    if (level === 0) {
      const a = int(2, 9), b = int(2, 9);
      q = kind % 2 ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a + b} − ${b}`, answer: a };
    } else if (level === 1) {
      const a = int(11, 49), b = int(3, 29);
      q = kind % 2 ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a + b} − ${a}`, answer: b };
    } else if (level === 2) {
      const a = int(3, 9), b = int(3, 12);
      q = kind === 0 ? { text: `${a * b} ÷ ${a}`, answer: b } : { text: `${a} × ${b}`, answer: a * b };
    } else if (level === 3) {
      const a = int(12, 29), b = int(3, 9), x = int(51, 99);
      q =
        kind === 0
          ? { text: `${a * b} ÷ ${b}`, answer: a }
          : kind === 1
            ? { text: `${x} + ${a}`, answer: x + a }
            : { text: `${a} × ${b}`, answer: a * b };
    } else {
      const a = int(13, 39), b = int(4, 12), c = int(2, 9);
      q =
        kind === 0
          ? { text: `${a} × ${b}`, answer: a * b }
          : kind === 1
            ? { text: `${a * c} ÷ ${c}`, answer: a }
            : kind === 2
              ? { text: `${a} × ${c} + ${b}`, answer: a * c + b }
              : { text: `${a + b} × ${c} − ${b}`, answer: (a + b) * c - b };
    }
    out.push(q);
  }
  return out;
}

export type DuelScore = { score: number; correct: number; attempted: number; bestCombo: number };

/**
 * Replays a round: answers must be in order (one per question), after the start, spaced like a human, and within
 * 30 seconds. Returns the score, or an error saying what was impossible.
 */
export function scoreRound(seed: number, answers: Answer[], elapsedMs: number): DuelScore | { error: string } {
  if (!Array.isArray(answers) || answers.length > MAX_QUESTIONS) return { error: "Too many answers." };
  const qs = questions(seed, Math.max(answers.length, 1));
  let prev = 0;
  let correct = 0;
  let combo = 0;
  let bestCombo = 0;
  for (let k = 0; k < answers.length; k++) {
    const { i, a, t } = answers[k];
    if (i !== k || !Number.isInteger(a) || !Number.isFinite(t)) return { error: "Answers are out of order." };
    if (t < prev + MIN_ANSWER_MS) return { error: "Answers came in faster than anyone can type." };
    if (t > DUEL_MS + GRACE_MS) return { error: "Answers after the 30 seconds." };
    if (t > elapsedMs + GRACE_MS) return { error: "Answers from the future." };
    prev = t;
    if (a === qs[k].answer) {
      correct++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
    } else {
      combo = 0;
    }
  }
  return { score: correct, correct, attempted: answers.length, bestCombo };
}
