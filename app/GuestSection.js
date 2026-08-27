"use client";

import { useEffect, useState } from "react";
import GuestName from "./GuestName";
import ReserveList from "./ReserveList";
import {
  readStoredName,
  sanitizeName,
  syncNameToUrl,
  writeStoredName,
} from "../lib/guestName";

export default function GuestSection({ items, urlName }) {
  // The first render has to match the server's, and the server only knows
  // `?g=` — localStorage is read once mounted, in the effect below.
  const [name, setName] = useState(urlName);
  const [draft, setDraft] = useState(urlName);
  const [editing, setEditing] = useState(!urlName);

  useEffect(() => {
    // A personalized link is an explicit choice, so it wins over whatever the
    // browser remembered; otherwise the remembered name fills the gap. Either
    // way the result is stored, so the next plain visit starts named.
    const resolved = urlName || readStoredName();
    setName(resolved);
    setDraft(resolved);
    writeStoredName(resolved);
    setEditing(!resolved);
  }, [urlName]);

  // Returns the name it settled on so a caller can use it in the same tick,
  // without waiting for the re-render.
  function commit(next) {
    const clean = sanitizeName(next);
    setName(clean);
    setDraft(clean);
    writeStoredName(clean);
    syncNameToUrl(clean);
    // A cleared name leaves the field open rather than showing an empty label.
    setEditing(!clean);
    return clean;
  }

  // Claiming with the editor open and a name typed into it is intent enough —
  // don't reject the guest for not having pressed "Enregistrer" first.
  function resolveName() {
    if (!editing) {
      if (!name) setEditing(true);
      return name;
    }
    const clean = sanitizeName(draft);
    // An empty field is a prompt to fill it in, not an instruction to forget
    // a name that was already saved.
    return clean ? commit(clean) : "";
  }

  return (
    <>
      <p className="sub">
        {name
          ? `Bonjour ${name} — touchez « Je m'en occupe » sur ce que vous aimeriez apporter.`
          : "Touchez « Je m'en occupe » sur ce que vous aimeriez apporter."}
      </p>

      <GuestName
        name={name}
        draft={draft}
        editing={editing}
        onDraftChange={setDraft}
        onEdit={() => {
          setDraft(name);
          setEditing(true);
        }}
        onCancel={() => {
          setDraft(name);
          setEditing(false);
        }}
        onSave={commit}
      />

      <ReserveList items={items} guestName={name} resolveName={resolveName} />
    </>
  );
}
