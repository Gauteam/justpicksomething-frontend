"use client";

import { useLayoutEffect, useRef } from "react";

// A textarea that starts one line tall and grows as its text wraps, so long
// values stay readable while typing. Works in every browser (no reliance on
// CSS field-sizing).
export function AutoTextarea({
  ref,
  value,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
  value: string;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`; // + borders
  }, [value]);

  return (
    <textarea
      {...props}
      rows={1}
      value={value}
      className={`resize-none overflow-hidden ${className}`}
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
}
