"use client";

import { useEffect, useRef, useState } from "react";

// The miniature on an item card. The sheet's Image column wins when it's
// filled in — that photo is the owner's choice and it renders with the page,
// no request needed. Only when there's no photo does the card ask the server
// what the item's link previews as, and until that comes back (or if nothing
// does) the card shows a placeholder rather than a hole.
//
// Previews resolved this visit, so collapsing a section and reopening it, or
// filtering the list back and forth, doesn't ask twice.
const resolved = new Map();

export default function ItemThumb({ item }) {
  const [preview, setPreview] = useState("");
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);

  const src = item.image || preview;

  useEffect(() => {
    if (item.image || !item.link) return;

    const cached = resolved.get(item.id);
    if (cached !== undefined) {
      setPreview(cached);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/preview?id=${item.id}`);
        const data = await res.json();
        const image = (data.ok && data.image) || "";
        resolved.set(item.id, image);
        if (!cancelled) setPreview(image);
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
  }, [item.id, item.image, item.link]);

  const body =
    src && !failed ? (
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
        onError={() => setFailed(true)}
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
