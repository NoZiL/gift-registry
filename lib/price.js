// Prices reach the app two ways. The list was imported with the price folded
// into the free-text `Notes` ("Poussette · Yoyo · 450 €"), and a dedicated
// `Price` column (G) can be filled in later without touching anything else.
// Both funnel through here so the recap totals the same way whichever the
// sheet happens to use.

// A French-formatted amount: "45", "45,90", "1 234,50", "1.234".
const AMOUNT = String.raw`\d+(?:[ \u00a0\u202f.,]\d+)*`;
const SYMBOL = String.raw`(?:€|EUR)`;
const PRICE_RE = new RegExp(`${SYMBOL}\\s*(${AMOUNT})|(${AMOUNT})\\s*${SYMBOL}`, "gi");
const NUMERIC_ONLY = /^[\d\s.,]+$/;

// Turns a matched amount into a number. The separators are ambiguous on their
// own ("1.234" is a thousand, "1.23" is a fraction), so the last one decides:
// one or two trailing digits make it the decimal point, anything else means
// every separator was grouping.
function toNumber(raw) {
  const s = String(raw).replace(/\s/g, "");
  if (!/\d/.test(s)) return null;

  const sep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  const normalized =
    sep !== -1 && s.length - sep - 1 <= 2
      ? `${s.slice(0, sep).replace(/[.,]/g, "")}.${s.slice(sep + 1)}`
      : s.replace(/[.,]/g, "");

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// `requireCurrency` guards the free-text case: a bare number in a note is far
// more likely to be "Lot de 3" or "0-6 mois" than a price, so only an amount
// next to € or EUR counts there. A dedicated price cell has no such ambiguity.
export function parsePrice(raw, { requireCurrency = true } = {}) {
  const text = String(raw || "").trim();
  if (!text) return null;

  // Notes read "Category · Brand · Price", so when several amounts show up the
  // last one is the price.
  let amount = null;
  for (const match of text.matchAll(PRICE_RE)) amount = match[1] ?? match[2];

  if (amount == null && !requireCurrency && NUMERIC_ONLY.test(text)) amount = text;

  return amount == null ? null : toNumber(amount);
}

// The price column wins when it's filled in; otherwise fall back to whatever
// the imported note carries. Returns null when neither says anything.
export function resolvePrice({ price, notes } = {}) {
  const fromColumn = parsePrice(price, { requireCurrency: false });
  return fromColumn == null ? parsePrice(notes) : fromColumn;
}

export function formatPrice(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    // Whole euros are the common case and "450 €" reads better than "450,00 €".
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}
