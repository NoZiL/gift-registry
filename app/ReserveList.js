"use client";

import { useEffect, useMemo, useState } from "react";

const NAME_REQUIRED = "Indiquez votre nom pour qu'on sache qui apporte quoi.";

// Keeps the sheet's own grouping ("Textiles", "Jeux et éveil", ...) and its
// order. Items listed before any section heading go in an unnamed first group,
// so nothing is dropped just because the sheet doesn't use sections at all.
function groupBySection(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

export default function ReserveList({ items, guestName, resolveName }) {
  const [claimed, setClaimed] = useState({}); // id -> true once handled this session
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
  // A section whose last item was just claimed disappears with it, rather than
  // leaving a heading over an empty gap.
  const groups = useMemo(() => groupBySection(visible), [visible]);

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {groups.map((group) => (
        <section className="group" key={group.section || "_"}>
          {group.section && <h2 className="group-title">{group.section}</h2>}

          <ul className="items">
            {group.items.map((item) => (
              <li key={item.id} className="item">
                <div className="item-main">
                  <span className="item-name">{item.item}</span>
                  {(item.store || item.price) && (
                    <span className="item-meta">
                      {item.store && <span>{item.store}</span>}
                      {item.store && item.price && <span aria-hidden="true"> · </span>}
                      {item.price && <span className="item-price">{item.price}</span>}
                    </span>
                  )}
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
                <button
                  onClick={() => handleReserve(item.id)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? "Enregistrement…" : "Je m'en occupe"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {visible.length === 0 && items.length > 0 && (
        <p className="empty">Merci d'avoir réservé — c'est noté ! 💛</p>
      )}
    </div>
  );
}
