/**
 * Market URLs are readable but resolved by id: `will-ahs-win-fridays-home-game-12`.
 * The trailing id is what actually identifies the market, so editing a question
 * never breaks an existing link and two markets can share wording safely.
 */

export function slugifyQuestion(question: string) {
  return question
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
}

export function marketSlug(market: { id: number; question: string }) {
  const words = slugifyQuestion(market.question);
  return words ? `${words}-${market.id}` : String(market.id);
}

/** Reads the market id back out of a slug. Returns null when the slug has no usable id. */
export function marketIdFromSlug(slug: string): number | null {
  const match = /(\d+)$/.exec(decodeURIComponent(slug));
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
