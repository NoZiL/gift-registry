// The guest's name can arrive two ways: from a personalized link (`?g=`) or
// from what the browser remembered on a previous visit. Everything funnels
// through here so the 80-char cap the reserve API enforces is applied the
// same way on the way in and on the way out.

export const NAME_MAX = 80;

const STORAGE_KEY = "giftRegistry.guestName";

export function sanitizeName(raw) {
  return String(raw || "").trim().slice(0, NAME_MAX);
}

export function readStoredName() {
  try {
    return sanitizeName(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private browsing or storage blocked — just act as if nothing was saved.
    return "";
  }
}

export function writeStoredName(name) {
  try {
    if (name) window.localStorage.setItem(STORAGE_KEY, name);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above: the name still works for this visit, it just won't stick.
  }
}

// Keep `?g=` in step with the name actually in use, so a refresh (or a link
// the guest re-shares) doesn't resurrect the name they just replaced.
export function syncNameToUrl(name) {
  try {
    const url = new URL(window.location.href);
    if (name) url.searchParams.set("g", name);
    else url.searchParams.delete("g");
    window.history.replaceState(null, "", url);
  } catch {
    // No history API — harmless, localStorage still carries the name.
  }
}
