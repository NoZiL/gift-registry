"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "../lib/price";

// What the guest has already claimed, and what it adds up to. The server can't
// render this with the page — most of the time the name lives in localStorage,
// which only exists once we're in the browser — so it's fetched per name.
export default function ReservationRecap({ name, version, onReleased }) {
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!name) {
      setItems([]);
      return;
    }

    // A name typed letter by letter would otherwise fire a request per
    // keystroke's worth of saved name; and a stale response must never land on
    // top of a newer one.
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/reservations?name=${encodeURIComponent(name)}`
        );
        const data = await res.json();
        if (cancelled) return;
        // The recap is a bonus on top of the list — if the sheet is unhappy the
        // page already says so, and a second red box helps nobody.
        setItems(data.ok ? data.items : []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [name, version]);

  async function handleRelease(item) {
    setBusyId(item.id);
    setError("");
    try {
      const res = await fetch("/api/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, name }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((list) => list.filter((i) => i.id !== item.id));
        onReleased(item);
      } else if (data.reason === "not_yours") {
        // Someone edited the sheet by hand, or the guest renamed themselves
        // after reserving. Either way it isn't theirs to hand back any more.
        setItems((list) => list.filter((i) => i.id !== item.id));
        setError("Cette réservation n'est plus à votre nom.");
      } else {
        setError("Impossible d'annuler pour le moment — merci de réessayer.");
      }
    } catch {
      setError("Impossible d'annuler pour le moment — merci de réessayer.");
    } finally {
      setBusyId(null);
    }
  }

  if (!name || items.length === 0) return null;

  const priced = items.filter((i) => typeof i.price === "number");
  const total = priced.reduce((sum, i) => sum + i.price, 0);
  const unpriced = items.length - priced.length;

  return (
    <section className="recap" aria-label="Vos réservations">
      <div className="recap-head">
        <div className="recap-heading">
          <h2 className="recap-title">Vos réservations</h2>
          <p className="recap-count">
            {items.length} article{items.length > 1 ? "s" : ""}
          </p>
        </div>
        {priced.length > 0 && (
          <p className="recap-total">
            <span className="recap-total-label">Total</span>
            <span className="recap-total-value">{formatPrice(total)}</span>
          </p>
        )}
      </div>

      <ul className="recap-items">
        {items.map((item) => (
          <li key={item.id} className="recap-item">
            <span className="recap-item-name">{item.item}</span>
            <span className="recap-item-price">
              {typeof item.price === "number" ? formatPrice(item.price) : "—"}
            </span>
            <button
              type="button"
              className="link-button"
              onClick={() => handleRelease(item)}
              disabled={busyId === item.id}
            >
              {busyId === item.id ? "Annulation…" : "Annuler"}
            </button>
          </li>
        ))}
      </ul>

      {unpriced > 0 && priced.length > 0 && (
        <p className="recap-note">
          {unpriced === 1
            ? "1 article sans prix indiqué n'est pas compté dans le total."
            : `${unpriced} articles sans prix indiqué ne sont pas comptés dans le total.`}
        </p>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
