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

// The participe.fr money pot, for guests who would rather chip in than pick
// a particular gift. `CAGNOTTE_URL` (set in Vercel) wins over the value below,
// so the link can be changed without a deploy of new code. With neither set,
// the cagnotte block simply isn't shown — better than a dead button.
const DEFAULT_CAGNOTTE_URL = "";

export function getCagnotteUrl() {
  const url = (process.env.CAGNOTTE_URL || DEFAULT_CAGNOTTE_URL).trim();
  // Only ever link out to a real web address.
  return /^https?:\/\//i.test(url) ? url : "";
}
