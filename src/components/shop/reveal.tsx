"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "header";
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * Fades content in the first time it scrolls into view. The hiding class is
 * added from the effect rather than the markup, so server-rendered and
 * script-free HTML is never left invisible.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  ...aria
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    element.classList.add("qassa-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.classList.remove("qassa-reveal");
        element.classList.add("qassa-reveal-in");
        if (delay) element.style.animationDelay = `${delay}ms`;
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      {...aria}
      className={className}
    >
      {children}
    </Tag>
  );
}
