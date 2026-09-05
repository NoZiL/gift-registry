"use client";

import { useEffect, useState } from "react";

const NAME_REQUIRED = "Indiquez votre nom pour qu'on sache qui apporte quoi.";

export default function ReserveList({
  items,
  hidden,
  restored,
  guestName,
  resolveName,
  onClaimed,
}) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  // Stop nagging for a name the moment there is one — otherwise the prompt
  // sits there until the next claim attempt. Other errors still stand.
  useEffect(() => {
    if (guestName) setError((e) => (e === NAME_REQUIRED ? "" : e));
  }, [guestName]);

  async function handleReserve(id) {
    const name = resolveName();
    if (!name) {
      setError(NAME_REQUIRED);
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
        onClaimed(id, true);
      } else if (data.reason === "already_reserved") {
        setError(`Quelqu'un a été plus rapide — déjà réservé par ${data.reservedBy}.`);
        onClaimed(id, false);
      } else {
        setError("Une erreur est survenue — merci de réessayer.");
      }
    } catch {
      setError("Une erreur est survenue — merci de réessayer.");
    } finally {
      setBusyId(null);
    }
  }

  // Items released this visit rejoin the ones the page was rendered with. The
  // id is the sheet's row number, so sorting by it restores the sheet's order
  // whichever way an item got here.
  const byId = new Map();
  for (const item of items) if (!hidden[item.id]) byId.set(item.id, item);
  for (const item of Object.values(restored)) {
    if (!hidden[item.id]) byId.set(item.id, item);
  }
  const visible = [...byId.values()].sort((a, b) => a.id - b.id);

  return (
    <div>
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
                  Voir l'article ↗
                </a>
              )}
            </div>
            <button onClick={() => handleReserve(item.id)} disabled={busyId === item.id}>
              {busyId === item.id ? "Enregistrement…" : "Je m'en occupe"}
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 && items.length > 0 && (
        <p className="empty">Merci d'avoir réservé — c'est noté ! 💛</p>
      )}
    </div>
  );
}
