// Shared shaping of the two columns the sheet added for filtering: Category
// (free text) and Price (whatever the owner typed or formatted). Both the
// server reader and the client UI go through here so a price is parsed and
// displayed the same way on both sides of the render.

// Items whose Category cell is empty still need a section to live in.
export const UNCATEGORIZED = "Sans catégorie";

export function categoryOf(item) {
  return item.category || UNCATEGORIZED;
}

// The Sheets API hands back the *formatted* cell, so a price arrives dressed
// however the sheet displays it: "25", "25,50 €", "$1,299.00", "1 299,00 EUR"
// (with the non-breaking spaces French formats use). Strip everything that
// isn't a digit or a separator, then work out which separator is the decimal
// point — French sheets say "25,50" and English ones say "25.50", and both
// land in the same list.
export function parsePrice(raw) {
  const digits = String(raw ?? "").replace(/[^\d.,]/g, "");
  if (!digits) return null;

  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  const sep = Math.max(lastComma, lastDot);

  let normalized;
  if (sep === -1) {
    normalized = digits;
  } else {
    const decimals = digits.length - sep - 1;
    // With both separators present the last one is the decimal point
    // ("1,299.00" / "1.299,00"). With only one, three trailing digits reads as
    // a thousands group ("1,500" is 1500, not 1.5); anything else is a decimal.
    const isDecimal =
      (lastComma !== -1 && lastDot !== -1) ||
      (decimals !== 3 && decimals !== 0);

    normalized = isDecimal
      ? digits.slice(0, sep).replace(/[.,]/g, "") + "." + digits.slice(sep + 1)
      : digits.replace(/[.,]/g, "");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// What to show on the card. A cell carrying anything but digits and separators
// was formatted by the owner — "$30", "CHF 25", "30 £" — so echo it back
// verbatim rather than guessing a currency on their behalf. A bare number gets
// the euro formatting the rest of the app assumes.
export function formatPrice(item) {
  const raw = String(item.priceRaw || "").trim();
  if (/[^\d\s.,]/.test(raw)) return raw;
  if (item.price == null) return "";
  const amount = Number.isInteger(item.price)
    ? String(item.price)
    : item.price.toFixed(2).replace(".", ",");
  return `${amount} €`;
}

// Groups in the order the categories first appear in the sheet, so the owner
// controls the running order by arranging rows. The leftovers read best at the
// bottom rather than wherever the first uncategorized row happens to sit.
export function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const key = categoryOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const entries = [...groups.entries()].map(([category, list]) => ({
    category,
    items: list,
  }));

  return [
    ...entries.filter((g) => g.category !== UNCATEGORIZED),
    ...entries.filter((g) => g.category === UNCATEGORIZED),
  ];
}

// `categories` is a Set; empty means "no category filter" rather than "match
// nothing". `min`/`max` are numbers or null.
export function matchesFilter(item, { categories, min, max }) {
  if (categories.size > 0 && !categories.has(categoryOf(item))) return false;
  if (min == null && max == null) return true;
  // An item with no price can't be shown to sit inside a price range. Hiding
  // it is the honest reading of the filter; ReserveList says how many that is
  // so nobody wonders where they went.
  if (item.price == null) return false;
  if (min != null && item.price < min) return false;
  if (max != null && item.price > max) return false;
  return true;
}
