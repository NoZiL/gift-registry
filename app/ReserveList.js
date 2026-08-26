"use client";

import { useState } from "react";

export default function ReserveList({ items, guestName: initialGuestName }) {
  const [claimed, setClaimed] = useState({}); // id -> true once handled this session
  const [nameDraft, setNameDraft] = useState(initialGuestName || "");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function handleReserve(id) {
    const name = (initialGuestName || nameDraft).trim();
    if (!name) {
      setError("Add your name first so we know who's bringing it.");
      return;
    }
    setError("");
    setBusyId(id);
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      const data = await res.json();
      if (data.ok) {
        setClaimed((c) => ({ ...c, [id]: true }));
      } else if (data.reason === "already_reserved") {
        setError(`Someone beat you to it — already claimed by ${data.reservedBy}.`);
        setClaimed((c) => ({ ...c, [id]: true }));
      } else {
        setError("Something went wrong — try again.");
      }
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = items.filter((i) => !claimed[i.id]);

  return (
    <div>
      {!initialGuestName && (
        <div className="name-box">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="e.g. Grandma Linda"
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <ul className="items">
        {visible.map((item) => (
          <li key={item.id} className="item">
            <div className="item-main">
              <span className="item-name">{item.item}</span>
              {item.notes && <span className="item-notes">{item.notes}</span>}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="item-link"
                >
                  View item ↗
                </a>
              )}
            </div>
            <button onClick={() => handleReserve(item.id)} disabled={busyId === item.id}>
              {busyId === item.id ? "Saving…" : "I'll bring this"}
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 && items.length > 0 && (
        <p className="empty">Thanks for claiming that — you're all set! 💛</p>
      )}
    </div>
  );
}
