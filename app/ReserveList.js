"use client";

import { useEffect, useState } from "react";
import CategoryGroup from "./CategoryGroup";
import ItemFilters from "./ItemFilters";
import {
  categoryOf,
  formatPrice,
  groupByCategory,
  matchesFilter,
  parsePrice,
  UNCATEGORIZED,
} from "../lib/registry";

const NAME_REQUIRED = "Indiquez votre nom pour qu'on sache qui apporte quoi.";

const NO_CATEGORY_FILTER = new Set();

export default function ReserveList({ items, guestName, resolveName }) {
  const [claimed, setClaimed] = useState({}); // id -> true once handled this session
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  // Kept as text, not numbers: the field has to be able to sit empty and to
  // hold a half-typed "25," while the guest is still going.
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [collapsed, setCollapsed] = useState(() => new Set());

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

  function toggleCategory(name) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleCollapsed(name) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function resetFilters() {
    setMinText("");
    setMaxText("");
    setSelected(new Set());
  }

  const unclaimed = items.filter((i) => !claimed[i.id]);

  // A field holding no digits at all just doesn't constrain the list, which is
  // gentler than an error under something still being typed. Digits anywhere
  // else are read as the bound, so "20 €" works as well as "20".
  const min = parsePrice(minText);
  const max = parsePrice(maxText);
  const priceActive = min != null || max != null;
  const active = priceActive || selected.size > 0;

  const visible = unclaimed.filter((i) =>
    matchesFilter(i, { categories: selected, min, max })
  );

  // Chip counts describe what picking that chip *would* show, so they answer
  // the price filter but not the category one — otherwise every unpicked chip
  // would read 0 as soon as one was picked.
  const priceMatched = unclaimed.filter((i) =>
    matchesFilter(i, { categories: NO_CATEGORY_FILTER, min, max })
  );
  const countByCategory = new Map();
  for (const item of priceMatched) {
    const key = categoryOf(item);
    countByCategory.set(key, (countByCategory.get(key) || 0) + 1);
  }
  // Built from every unclaimed item rather than from `priceMatched`, so a chip
  // that is currently selected never vanishes out from under the guest before
  // they can unselect it.
  const categories = groupByCategory(unclaimed).map(({ category }) => ({
    name: category,
    count: countByCategory.get(category) || 0,
  }));

  // A price bound drops the items that have no price at all. Say how many, so
  // a guest who knows the list doesn't think something went missing.
  const hiddenNoPrice = priceActive
    ? unclaimed.filter(
        (i) =>
          i.price == null &&
          (selected.size === 0 || selected.has(categoryOf(i)))
      ).length
    : 0;

  // Only worth showing the controls when the sheet has something to filter on.
  const hasCategories = categories.some((c) => c.name !== UNCATEGORIZED);
  const hasPrices = unclaimed.some((i) => i.price != null);
  const showFilters = hasCategories || hasPrices;

  function renderItem(item) {
    const price = formatPrice(item);
    return (
      <li key={item.id} className="item">
        <div className="item-main">
          <span className="item-head">
            <span className="item-name">{item.item}</span>
            {price && <span className="item-price">{price}</span>}
          </span>
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
    );
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {showFilters && unclaimed.length > 0 && (
        <ItemFilters
          categories={categories}
          selected={selected}
          onToggleCategory={toggleCategory}
          minText={minText}
          maxText={maxText}
          onMinChange={setMinText}
          onMaxChange={setMaxText}
          onReset={resetFilters}
          active={active}
          shown={visible.length}
          total={unclaimed.length}
          hiddenNoPrice={hiddenNoPrice}
        />
      )}

      {/* Without a single category filled in, sections would be one "Sans
          catégorie" wrapper around the whole list — so fall back to the flat
          list the app had before. */}
      {hasCategories ? (
        <div className="groups">
          {groupByCategory(visible).map(({ category, items: groupItems }) => (
            <CategoryGroup
              key={category}
              category={category}
              count={groupItems.length}
              collapsed={collapsed.has(category)}
              onToggle={() => toggleCollapsed(category)}
            >
              <ul className="items">{groupItems.map(renderItem)}</ul>
            </CategoryGroup>
          ))}
        </div>
      ) : (
        <ul className="items">{visible.map(renderItem)}</ul>
      )}

      {unclaimed.length === 0 && items.length > 0 && (
        <p className="empty">Merci d'avoir réservé — c'est noté ! 💛</p>
      )}

      {unclaimed.length > 0 && visible.length === 0 && (
        <p className="empty empty-none">
          Aucun article ne correspond à ces filtres.{" "}
          <button type="button" className="link-button" onClick={resetFilters}>
            Tout afficher
          </button>
        </p>
      )}
    </div>
  );
}
