"use client";

import { useId } from "react";

// One collapsible category section. The body stays mounted and is hidden with
// `hidden` rather than unmounted, so collapsing a section can't disturb the
// list below it or lose anything mid-reservation.
export default function CategoryGroup({
  category,
  count,
  collapsed,
  onToggle,
  children,
}) {
  const bodyId = useId();

  return (
    <section className="group">
      <button
        type="button"
        className="group-header"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span className={`group-caret${collapsed ? " group-caret-closed" : ""}`} aria-hidden="true">
          ▾
        </span>
        <span className="group-title">{category}</span>
        <span className="group-count">{count}</span>
      </button>
      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
