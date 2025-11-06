"use client";
import { useEffect, useRef } from "react";

/**
 * Attaching this ref to a container will block any <a> clicks inside it
 * (capture phase), preventing parent <Link> wrappers from hijacking clicks.
 */
export function useNoLinkClicks<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const block = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const a = t.closest("a");
      if (a && el.contains(a)) {
        e.preventDefault();
        e.stopPropagation();
        // @ts-ignore
        e.nativeEvent?.stopImmediatePropagation?.();
      }
    };

    el.addEventListener("click", block, true);
    el.addEventListener("pointerdown", block, true);
    el.addEventListener("mousedown", block, true);

    return () => {
      el.removeEventListener("click", block, true);
      el.removeEventListener("pointerdown", block, true);
      el.removeEventListener("mousedown", block, true);
    };
  }, []);

  return ref;
}
