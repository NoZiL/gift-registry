"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState("");

  const [guestName, setGuestName] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function unlock(e) {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setUnlocked(true);
      } else {
        setAuthError("Wrong password.");
      }
    } catch {
      setAuthError("Something went wrong — try again.");
    }
  }

  function generate(e) {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    const base =
      process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const url = `${base}/?g=${encodeURIComponent(name)}`;
    setLink(url);
    setCopied(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // clipboard API not available — user can still select the text manually
    }
  }

  if (!unlocked) {
    return (
      <main className="wrap">
        <h1>Admin</h1>
        <form onSubmit={unlock} className="admin-form">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Unlock</button>
          {authError && <p className="error">{authError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>Generate a guest link</h1>
      <p className="sub">
        Type a guest's name to get a personal link + QR code. When they use it,
        anything they reserve is automatically tagged with their name — no
        login, no typing on their end.
      </p>

      <form onSubmit={generate} className="admin-form">
        <label htmlFor="guest">Guest name</label>
        <input
          id="guest"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="e.g. Grandma Linda"
        />
        <button type="submit">Generate</button>
      </form>

      {link && (
        <div className="result">
          <img
            src={`/api/qr?text=${encodeURIComponent(link)}`}
            alt={`QR code for ${guestName}`}
            width={240}
            height={240}
          />
          <p className="link-text">{link}</p>
          <button onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
          <p className="hint">
            Long-press (or right-click) the QR code to save the image.
          </p>
        </div>
      )}
    </main>
  );
}
