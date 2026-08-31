import { getItems } from "../lib/sheets";
import GuestSection from "./GuestSection";
import { sanitizeName } from "../lib/guestName";

// Always hit the sheet fresh — this is a low-traffic family app, no need to cache.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const resolvedParams = await searchParams;
  const urlName = sanitizeName(resolvedParams?.g);

  let items = [];
  let loadFailed = false;
  try {
    items = await getItems();
  } catch (err) {
    // Log the detail server-side; guests only ever see a generic message, so
    // a misconfigured sheet can't leak the service account address publicly.
    console.error("Failed to load items from the sheet", err);
    loadFailed = true;
  }

  const available = items.filter((i) => !i.reserved);

  return (
    <main className="wrap">
      <h1>Liste de naissance</h1>
      <p className="intro">
        Voici une petite liste des essentiels dont nous aurons (réellement)
        besoin. Merci beaucoup de vouloir nous accompagner dans cette aventure !
      </p>

      {loadFailed && (
        <p className="error">
          Impossible de charger la liste pour le moment. Merci de réessayer dans
          un instant.
        </p>
      )}

      {!loadFailed && available.length === 0 && (
        <p className="empty">Tout a été réservé — merci beaucoup ! 💛</p>
      )}

      <GuestSection items={available} urlName={urlName} />
    </main>
  );
}
