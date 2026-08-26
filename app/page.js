import { getItems } from "../lib/sheets";
import ReserveList from "./ReserveList";

// Always hit the sheet fresh — this is a low-traffic family app, no need to cache.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const resolvedParams = await searchParams;
  const guestName = (resolvedParams?.g || "").toString().trim().slice(0, 80);

  let items = [];
  let loadError = null;
  try {
    items = await getItems();
  } catch (err) {
    loadError = err.message;
  }

  const available = items.filter((i) => !i.reserved);

  return (
    <main className="wrap">
      <h1>Baby Registry</h1>
      <p className="sub">
        {guestName
          ? `Hi ${guestName} — tap "I'll bring this" on anything you'd like to take care of.`
          : "Tap \"I'll bring this\" on anything you'd like to take care of."}
      </p>

      {loadError && (
        <p className="error">
          Couldn't load the list right now. (The couple should check the app's setup —
          error: {loadError})
        </p>
      )}

      {!loadError && available.length === 0 && (
        <p className="empty">Everything on the list has been claimed — thank you! 💛</p>
      )}

      <ReserveList items={available} guestName={guestName} />
    </main>
  );
}
