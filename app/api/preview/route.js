import { NextResponse } from "next/server";
import { getRegistry } from "../../../lib/sheets";
import { extractPreviewImage } from "../../../lib/preview";

// The thumbnail an item card falls back to when the sheet's Image column is
// empty: whatever picture the shop's own page advertises to link previews
// (og:image and friends).
//
// The route takes a row id, never a URL. That's the guard: the only pages this
// server will ever fetch are the ones the list owner put in the sheet, so a
// public endpoint can't be pointed at an internal address. The row is resolved
// through a short-lived copy of the list rather than a read per card.

// Fetches are capped in three directions — how long we wait, how much we read,
// and what we accept — because the pages on the other end are big commercial
// ones we don't control.
const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 256 * 1024;

// A shop's preview image changes about never, so a long hold costs nothing and
// spares both sides the round trip. A miss is retried sooner: it's often a slow
// page or a hiccup rather than a page with no image at all.
const HIT_TTL_MS = 12 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const ITEMS_TTL_MS = 60 * 1000;

// Per serverless instance, like the resolved tab title in lib/sheets — warm
// instances answer instantly, cold ones pay for one page fetch.
const previews = new Map();
let itemsCache = { at: 0, byId: new Map() };

async function linkFor(id) {
  const now = Date.now();
  if (now - itemsCache.at > ITEMS_TTL_MS) {
    const { items } = await getRegistry();
    itemsCache = {
      at: now,
      byId: new Map(items.map((i) => [i.id, i])),
    };
  }
  return itemsCache.byId.get(id)?.link || "";
}

// Reads the head of the response and stops there. Product pages routinely run
// to megabytes of markup, and the tags we're after are in the first few KB.
async function readHead(res) {
  const reader = res.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder("utf-8", { fatal: false });
  let html = "";
  let bytes = 0;

  try {
    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      // Everything we look for lives in the head; once it's closed there is
      // nothing left to find.
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return html;
}

async function previewImage(link) {
  const cached = previews.get(link);
  if (cached && Date.now() < cached.until) return cached.image;

  let image = "";
  try {
    const res = await fetch(link, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some shops serve a stripped page, or none at all, to a client that
        // doesn't look like a browser.
        "User-Agent":
          "Mozilla/5.0 (compatible; GiftRegistryPreview/1.0; +link preview)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr,en;q=0.8",
      },
    });

    const type = res.headers.get("content-type") || "";
    if (res.ok && /text\/html|application\/xhtml/i.test(type)) {
      // res.url, not link: a redirect means relative image paths resolve
      // against where we actually landed.
      image = extractPreviewImage(await readHead(res), res.url || link);
    }
  } catch {
    // A shop that is slow, down, or refuses us is not an error worth showing a
    // guest — the card just keeps its placeholder.
  }

  previews.set(link, {
    image,
    until: Date.now() + (image ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return image;
}

export async function GET(request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 2) {
    return NextResponse.json({ ok: false, reason: "invalid_id" }, { status: 400 });
  }

  let link;
  try {
    link = await linkFor(id);
  } catch (err) {
    // Same reasoning as the page and the recap: log the detail, tell the guest
    // nothing that describes the sheet.
    console.error("preview error", err);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }

  if (!link) {
    return NextResponse.json({ ok: true, image: "" });
  }

  const image = await previewImage(link);

  return NextResponse.json(
    { ok: true, image },
    {
      headers: {
        // Long enough that scrolling back up, or a second visit, doesn't ask
        // again; short on a miss, for the same reason the server cache is.
        "Cache-Control": image
          ? "public, max-age=86400"
          : "public, max-age=600",
      },
    }
  );
}
