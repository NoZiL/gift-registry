"use client";

// The filter bar above the list: category chips and a price range. Purely
// presentational — ReserveList owns the state and does the filtering, so the
// counts shown here always describe the list actually rendered below.
export default function ItemFilters({
  categories,
  selected,
  onToggleCategory,
  minText,
  maxText,
  onMinChange,
  onMaxChange,
  onReset,
  active,
  shown,
  total,
  hiddenNoPrice,
}) {
  const showCategories = categories.length > 1;

  return (
    <div className="filters">
      <div className="filters-head">
        <span className="filters-title">Filtrer</span>
        {active && (
          <button type="button" className="link-button" onClick={onReset}>
            Réinitialiser
          </button>
        )}
      </div>

      {showCategories && (
        <div className="filter-row">
          <span className="filter-label">Catégories</span>
          <div className="chips">
            {categories.map(({ name, count }) => {
              const on = selected.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`chip${on ? " chip-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => onToggleCategory(name)}
                >
                  {name}
                  <span className="chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="filter-row">
        <span className="filter-label">Prix</span>
        <div className="price-range">
          {/* Not type="number": a French guest types "25,50" and a number
              input silently refuses the comma. Text plus inputMode keeps the
              numeric keypad on mobile, and the parser takes either separator. */}
          <input
            id="price-min"
            className="price-input"
            type="text"
            inputMode="decimal"
            value={minText}
            onChange={(e) => onMinChange(e.target.value)}
            placeholder="Min"
            aria-label="Prix minimum"
          />
          <span className="price-dash" aria-hidden="true">
            –
          </span>
          <input
            id="price-max"
            className="price-input"
            type="text"
            inputMode="decimal"
            value={maxText}
            onChange={(e) => onMaxChange(e.target.value)}
            placeholder="Max"
            aria-label="Prix maximum"
          />
        </div>
      </div>

      {active && (
        <p className="filters-summary" role="status">
          {shown} sur {total} article{total > 1 ? "s" : ""}
          {hiddenNoPrice > 0 &&
            ` · ${hiddenNoPrice} sans prix indiqué ${
              hiddenNoPrice > 1 ? "sont masqués" : "est masqué"
            }`}
        </p>
      )}
    </div>
  );
}
