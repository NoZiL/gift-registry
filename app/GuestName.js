"use client";

import { useEffect, useRef } from "react";
import { NAME_MAX } from "../lib/guestName";

// The name in view mode, with a way into edit mode. State lives in the parent
// so the greeting, the editor and the reserve calls all read the same name.
export default function GuestName({
  name,
  draft,
  editing,
  invalid,
  alert,
  onDraftChange,
  onEdit,
  onCancel,
  onSave,
}) {
  const inputRef = useRef(null);
  const wasEditing = useRef(editing);

  // Focus only when the editor is *opened*, never on mount: a plain first
  // visit already starts in edit mode, and stealing focus there scrolls the
  // list away and pops the keyboard open on mobile.
  useEffect(() => {
    if (editing && !wasEditing.current) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    wasEditing.current = editing;
  }, [editing]);

  // A claim attempted with no name: bring the field into view and focus it.
  // Runs after render, so the input exists even if the editor was just opened.
  useEffect(() => {
    if (!alert) return;
    const input = inputRef.current;
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  }, [alert]);

  if (!editing) {
    return (
      <div className="name-box name-box-view">
        <div className="name-box-current">
          <span className="name-box-label">Vous réservez en tant que</span>
          <span className="name-box-value">{name}</span>
        </div>
        <button type="button" className="link-button" onClick={onEdit}>
          Modifier
        </button>
      </div>
    );
  }

  return (
    <form
      className={`name-box${invalid ? " name-box-invalid" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <label htmlFor="guest-name">Votre nom</label>
      <input
        id="guest-name"
        ref={inputRef}
        value={draft}
        maxLength={NAME_MAX}
        aria-invalid={invalid || undefined}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder="ex. Mamie Christiane"
      />
      <div className="name-box-actions">
        <button type="submit">Enregistrer</button>
        {name && (
          <button type="button" className="link-button" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
