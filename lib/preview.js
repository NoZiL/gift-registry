// Everything the thumbnail on an item card needs, split so the same rules
// apply on both sides: the sheet's own Image column is normalized during the
// server render, and the fallback — an og:image scraped from the item's link —
// is normalized again in the API route before it ever reaches the browser.

// Only https images make it onto a card. The page is served over https in
// production, so an http image would be blocked as mixed content anyway;
// upgrading is what the browser would attempt on its own, and a URL that
// doesn't answer over https just falls back to the placeholder.
export function normalizeImageUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";

  let url;
  try {
    url = new URL(value);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  url.protocol = "https:";

  return driveThumbnail(url) || url.toString();
}

// A photo dropped in Drive and shared gives you a link to Drive's *viewer*
// page, not to the file, so pasting it into the sheet would render nothing.
// The thumbnail endpoint serves the actual bytes at a size a 56px card wants,
// which is the whole point of putting the photo there. The file still has to
// be shared with "anyone with the link".
function driveThumbnail(url) {
  if (url.hostname !== "drive.google.com") return "";

  const inPath = url.pathname.match(/\/file\/d\/([^/]+)/);
  const id = inPath ? inPath[1] : url.searchParams.get("id");
  if (!id) return "";

  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w400`;
}

// Meta tags carry the image URL as an attribute value, so the usual suspects
// arrive escaped — `&amp;` in a query string above all, which breaks the URL
// if it's passed through as-is.
function decodeEntities(value) {
  return value
    .replace(/&(?:#39|#x27|apos);/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function attr(tag, names) {
  const pattern = new RegExp(
    `\\b(?:${names.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i"
  );
  const match = tag.match(pattern);
  if (!match) return "";
  return decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim();
}

// Preference order, best first. Merchants are inconsistent about which of
// these they fill in — plenty set only the Twitter pair, a few only the old
// `image_src` link — so try them all rather than betting on Open Graph.
const IMAGE_KEYS = [
  "og:image:secure_url",
  "og:image:url",
  "og:image",
  "twitter:image",
  "twitter:image:src",
  "image",
];

// Pulls a preview image out of a fetched page. Regex rather than a parser:
// the whole job is a handful of self-closing tags in the head, and a parser
// dependency would be a lot of weight for that.
export function extractPreviewImage(html, pageUrl) {
  const found = new Map();

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = attr(tag, ["property", "name", "itemprop"]).toLowerCase();
    if (!key || !IMAGE_KEYS.includes(key) || found.has(key)) continue;
    const content = attr(tag, ["content"]);
    if (content) found.set(key, content);
  }

  for (const key of IMAGE_KEYS) {
    const resolved = resolve(found.get(key), pageUrl);
    if (resolved) return resolved;
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (attr(tag, ["rel"]).toLowerCase() !== "image_src") continue;
    const resolved = resolve(attr(tag, ["href"]), pageUrl);
    if (resolved) return resolved;
  }

  return "";
}

// og:image is allowed to be a relative path, and some sites use one.
function resolve(candidate, pageUrl) {
  if (!candidate) return "";
  try {
    return normalizeImageUrl(new URL(candidate, pageUrl).toString());
  } catch {
    return "";
  }
}

// A preview is addressed by what it is a preview *of* — the item's link —
// rather than by the item's row number. A row number is a position: inserting
// or deleting a line in the sheet slides every row under it onto a new number,
// and the guest's browser, holding a day-long cache of "row 42 looks like
// this", would go on showing yesterday's picture next to today's item. A key
// derived from the link moves with the item instead of staying behind.
//
// Two rows pointing at the same page share a key on purpose: that's one fetch
// and one answer, and the picture is the same either way.
//
// Not a secret and not a security boundary — the route resolves a key against
// the sheet's own links and will only ever fetch one of those, so a key nobody
// put in the sheet simply matches nothing. It has to be stable and distinct
// across one family's list, which is all this is.
export function previewKey(link) {
  const value = String(link ?? "").trim();
  if (!value) return "";
  // Two passes with different starting values, for 16 hex characters rather
  // than 8 — cheap insurance against two links in one list colliding.
  return fnv1a(value, 0x811c9dc5) + fnv1a(value, 0x01000193);
}

function fnv1a(value, seed) {
  let hash = seed;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    // The FNV prime as shifts: `hash * 16777619` would climb past 2^53 and
    // start losing the low bits to floating point.
    hash =
      (hash +
        ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>>
      0;
  }
  return hash.toString(16).padStart(8, "0");
}
