"use client";

import { useState } from "react";
import { sanitizeName } from "../lib/guestName";

export default function ReserveList({ items, guestName, onNameMissing }) {
  const [claimed, setClaimed] = useState({}); // id -> true once handled this session
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function handleReserve(id) {
    const name = sanitizeName(guestName);
    if (!name) {
      setError("Indiquez votre nom pour qu'on sache qui apporte quoi.");
      onNameMissing?.();
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
        setError(`Quelqu'un a été plus rapide — déjà réservé par ${data.reservedBy}.`);
        setClaimed((c) => ({ ...c, [id]: true }));
      } else {
        setError("Une erreur est survenue — merci de réessayer.");
      }
    } catch {
      setError("Une erreur est survenue — merci de réessayer.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = items.filter((i) => !claimed[i.id]);

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
