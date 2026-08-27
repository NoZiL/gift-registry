"use client";

import { useEffect, useRef, useState } from "react";
import { NAME_MAX, sanitizeName } from "../lib/guestName";

// The name in view mode, with a way into edit mode. State lives in the parent
// so the greeting and the reserve calls always see the same name.
export default function GuestName({ name, editing, onEdit, onCancel, onSave }) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef(null);

  // Opening the editor starts from the name in use, never a stale draft.
  useEffect(() => {
    if (!editing) return;
    setDraft(name);
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, [editing, name]);

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
      className="name-box"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(sanitizeName(draft));
      }}
    >
      <label htmlFor="guest-name">Votre nom</label>
      <input
        id="guest-name"
        ref={inputRef}
        value={draft}
        maxLength={NAME_MAX}
        onChange={(e) => setDraft(e.target.value)}
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
