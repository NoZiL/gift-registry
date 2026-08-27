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
  const [editing, setEditing] = useState(!urlName);

  useEffect(() => {
    // A personalized link is an explicit choice, so it wins over whatever the
    // browser remembered; otherwise the remembered name fills the gap. Either
    // way the result is stored, so the next plain visit starts named.
    const resolved = urlName || readStoredName();
    setName(resolved);
    writeStoredName(resolved);
    setEditing(!resolved);
  }, [urlName]);

  function save(next) {
    const clean = sanitizeName(next);
    setName(clean);
    writeStoredName(clean);
    syncNameToUrl(clean);
    // A cleared name leaves the field open rather than showing an empty label.
    setEditing(!clean);
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
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        onSave={save}
      />

      <ReserveList
        items={items}
        guestName={name}
        onNameMissing={() => setEditing(true)}
      />
    </>
  );
}
