// Everything about Victoire herself that the page shows, kept in one place.
// It comes straight from the birth announcement (faire-part), and unlike the
// gift list it doesn't change — so it lives here rather than in the sheet.
export const BABY = {
  name: "Victoire",
  birthDate: "27 octobre 2026",
  weight: "3,6 kg",
  length: "51 cm",
  time: "16h45",
  message: "Depuis son arrivée, nous sommes comblés de bonheur.",
};

// The onparticipe.fr money pot, for guests who would rather chip in than pick
// a particular gift. `CAGNOTTE_URL` (set in Vercel) wins over the value below
// whenever it's defined — set it to an empty value to take the block down
// once the pot closes. Anything that isn't a valid https:// address hides the
// block too: better no button than a broken or insecure one.
const DEFAULT_CAGNOTTE_URL = "https://www.onparticipe.fr/c/Ae3rBEBY";

// Returns { url, host } for the cagnotte, or null when there's none to show.
export function getCagnotte() {
  const raw = (process.env.CAGNOTTE_URL ?? DEFAULT_CAGNOTTE_URL).trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || !parsed.hostname) return null;
    return { url: parsed.href, host: parsed.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}
