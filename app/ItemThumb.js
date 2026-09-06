"use client";

import { useEffect, useRef, useState } from "react";

// The miniature on an item card. The sheet's Image column wins when it's
// filled in — that photo is the owner's choice and it renders with the page,
// no request needed. Only when there's no photo does the card ask the server
// what the item's link previews as, and until that comes back (or if nothing
// does) the card shows a placeholder rather than a hole.
//
// Previews resolved this visit, keyed the way the route keys them: by the link,
// never by the row the item sits on. A row number is a position, and a sheet
// that gets a line inserted hands every id below it to a different item — so a
// picture filed under one would resurface next to something unrelated.
const resolved = new Map();

export default function ItemThumb({ item }) {
  // The image and the key it was fetched for travel together, so a picture can
  // never outlive the item it belongs to: if this card is reused for another
  // row — an id the sheet has since moved, an item put back by the recap — the
  // keys stop matching and the stale picture stops rendering, without waiting
  // for the replacement to arrive.
  const [preview, setPreview] = useState(null);
  // Which src failed, rather than whether one did. A card that gets a new
  // picture deserves a fresh try at showing it.
  const [failedSrc, setFailedSrc] = useState("");
  const ref = useRef(null);

  const linkKey = item.previewKey || "";
  const fallback = preview && preview.key === linkKey ? preview.image : "";
  const src = item.image || fallback;

  useEffect(() => {
    if (item.image || !linkKey) return;

    const cached = resolved.get(linkKey);
    if (cached !== undefined) {
      setPreview({ key: linkKey, image: cached });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/preview?key=${linkKey}`);
        const data = await res.json();
        const image = (data.ok && data.image) || "";
        resolved.set(linkKey, image);
        if (!cancelled) setPreview({ key: linkKey, image });
      } catch {
        // Leave it unresolved rather than remembered, so a flaky moment
        // doesn't cost the card its picture for the rest of the visit.
      }
    }

    // A list of thirty items shouldn't fire thirty page fetches on load, and a
    // collapsed section shouldn't fire any: a hidden element never intersects,
    // so opening the section is what asks. The margin means the picture is
    // usually there by the time the card is.
    if (typeof IntersectionObserver !== "function") {
      load();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        load();
      },
      { rootMargin: "300px" }
    );
    if (ref.current) observer.observe(ref.current);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [linkKey, item.image]);

  const body =
    src && src !== failedSrc ? (
      <img
        src={src}
        // Decorative: the item's name is right beside it, and a screen reader
        // reading a merchant's filename out loud helps nobody.
        alt=""
        className="thumb-img"
        loading="lazy"
        // Image CDNs that block hotlinking mostly do it on the Referer header,
        // and sending none gets through more often than sending ours.
        referrerPolicy="no-referrer"
        // A hotlink-blocked or dead image would otherwise leave a broken-icon
        // box on the card.
        onError={() => setFailedSrc(src)}
      />
    ) : (
      <span className="thumb-fallback" aria-hidden="true">
        🎁
      </span>
    );

  // Tapping the picture opens the shop, which is what a preview invites — but
  // it's the same destination as the "Voir l'article" link below it, so it
  // stays out of the tab order and out of the accessibility tree.
  return item.link ? (
    <a
      ref={ref}
      className="thumb"
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={-1}
      aria-hidden="true"
    >
      {body}
    </a>
  ) : (
    <span ref={ref} className="thumb">
      {body}
    </span>
  );
}
