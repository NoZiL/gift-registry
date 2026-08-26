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
        setAuthError("Mot de passe incorrect.");
      }
    } catch {
      setAuthError("Une erreur est survenue — merci de réessayer.");
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
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Déverrouiller</button>
          {authError && <p className="error">{authError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>Générer un lien invité</h1>
      <p className="sub">
        Saisissez le nom d'un invité pour obtenir un lien personnel et son QR
        code. Quand il l'utilise, tout ce qu'il réserve est automatiquement
        associé à son nom — aucune connexion, rien à taper de son côté.
      </p>

      <form onSubmit={generate} className="admin-form">
        <label htmlFor="guest">Nom de l'invité</label>
        <input
          id="guest"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="ex. Mamie Christiane"
        />
        <button type="submit">Générer</button>
      </form>

      {link && (
        <div className="result">
          <img
            src={`/api/qr?text=${encodeURIComponent(link)}`}
            alt={`QR code pour ${guestName}`}
            width={240}
            height={240}
          />
          <p className="link-text">{link}</p>
          <button onClick={copyLink}>{copied ? "Copié !" : "Copier le lien"}</button>
          <p className="hint">
            Appuyez longuement (ou faites un clic droit) sur le QR code pour
            enregistrer l'image.
          </p>
        </div>
      )}
    </main>
  );
}
