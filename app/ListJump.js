"use client";

import { useEffect, useState } from "react";

// On a phone the list starts several screens down — under the faire-part, the
// intro, the guide and the name box — and a guest who doesn't think to scroll
// can believe that's all there is. This floating button says the list exists
// and takes them to it. It only shows while the list is still below the
// screen: once any of it is in view, or the guest has scrolled past its top,
// it gets out of the way.
export default function ListJump({ targetId }) {
  const [below, setBelow] = useState(false);
  // A fixed button would sit on top of the keyboard and the field being
  // typed in, so it steps aside while any field has focus.
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  useEffect(() => {
    const isField = (el) => el?.matches?.("input, textarea, select");
    const onIn = (e) => setTyping(isField(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  function jump() {
    const target = document.getElementById(targetId);
    if (!target) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  const shown = below && !typing;

  return (
    <button
      type="button"
      className={`list-jump${shown ? " list-jump-shown" : ""}`}
      onClick={jump}
      // Hidden from tapping and from screen readers too while it's tucked away.
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
    >
      Voir la liste des cadeaux <span aria-hidden="true">↓</span>
    </button>
  );
}
