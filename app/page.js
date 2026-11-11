import { getRegistry } from "../lib/sheets";
import GuestSection from "./GuestSection";
import Hero from "./Hero";
import Cagnotte from "./Cagnotte";
import { getCagnotte } from "../lib/site";
import { sanitizeName } from "../lib/guestName";

// Always hit the sheet fresh — this is a low-traffic family app, no need to cache.
export const dynamic = "force-dynamic";

// Used only when the sheet carries no wording of its own above its header row.
const DEFAULT_TITLE = "Liste de naissance";
const DEFAULT_INTRO = [
  "Voici une petite liste des essentiels dont nous aurons (réellement) besoin. " +
    "Merci beaucoup de vouloir nous accompagner dans cette aventure !",
];

export default async function Home({ searchParams }) {
  const resolvedParams = await searchParams;
  const urlName = sanitizeName(resolvedParams?.g);

  let registry = { title: "", intro: [], items: [] };
  let loadFailed = false;
  try {
    registry = await getRegistry();
  } catch (err) {
    // Log the detail server-side; guests only ever see a generic message, so
    // a misconfigured sheet can't leak the service account address publicly.
    console.error("Failed to load items from the sheet", err);
    loadFailed = true;
  }

  // The heading and intro live in the sheet, above the table, where they were
  // written — so they can be reworded without a deploy.
  const title = registry.title || DEFAULT_TITLE;
  const intro = registry.intro.length ? registry.intro : DEFAULT_INTRO;
  // Reserved items stay on the page, greyed out, so guests can see the whole
  // list and what's already covered. Who reserved them is the family's
  // business, not every guest's: the names never leave the server.
  const items = registry.items.map(({ reservedBy, reservedAt, ...item }) => item);
  const allReserved = items.length > 0 && items.every((i) => i.reserved);
  const cagnotte = getCagnotte();

  return (
    <main className="wrap">
      <Hero />

      <h1 className="page-title">{title}</h1>
      {intro.map((paragraph, i) => (
        <p className="intro" key={i}>
          {paragraph}
        </p>
      ))}

      {/* Right under the intro, so a guest who'd rather give money than pick
          an item finds out before scrolling the whole list. */}
      <Cagnotte cagnotte={cagnotte} />

      {loadFailed && (
        <p className="error">
          Impossible de charger la liste pour le moment. Merci de réessayer dans
          un instant.
        </p>
      )}

      {!loadFailed && allReserved && (
        <p className="empty">
          Tout a été réservé — merci beaucoup !
          {cagnotte && " Il reste toujours la cagnotte, juste au-dessus."}
        </p>
      )}

      <GuestSection items={items} urlName={urlName} />
    </main>
  );
}
