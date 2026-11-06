"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ShopTemplate } from "@/lib/shops/templates";

type Props = {
  urls: string[];
  shopName: string;
  template: ShopTemplate;
};

export function StorefrontGallery({ urls, shopName, template }: Props) {
  const t = useTranslations("discover");
  const [focused, setFocused] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const panelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = lightbox !== null;

  const openLightbox = (index: number) => {
    triggerRef.current = panelRefs.current[index] ?? null;
    setLightbox(index);
  };

  const close = useCallback(() => {
    setLightbox(null);
    // The dialog is gone by the next paint, so focus has to follow it back.
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight") {
        setLightbox((index) => (index === null ? index : (index + 1) % urls.length));
      } else if (event.key === "ArrowLeft") {
        setLightbox((index) =>
          index === null ? index : (index - 1 + urls.length) % urls.length,
        );
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, isOpen, urls.length]);

  if (urls.length === 0) return null;

  const caption = (index: number) =>
    t("galleryImageAria", { name: shopName, index: index + 1 });

  return (
    <section aria-labelledby="gallery-title" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="gallery-title" className="font-display text-2xl font-bold sm:text-3xl">
          {t("galleryTitle")}
        </h2>
        <p className={`text-sm ${template.muted}`}>{t("galleryHint")}</p>
      </div>

      {/* Pointer devices: panels expand on hover, the way a lookbook should breathe. */}
      <div className="qassa-accordion mt-6 hidden lg:flex">
        {urls.map((url, index) => (
          <button
            key={url}
            ref={(element) => {
              panelRefs.current[index] = element;
            }}
            type="button"
            data-active={index === focused}
            aria-label={caption(index)}
            onMouseEnter={() => setFocused(index)}
            onFocus={() => setFocused(index)}
            onClick={() => openLightbox(index)}
            className="qassa-accordion-panel rounded-xl ring-1 ring-black/10"
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="(max-width: 1280px) 55vw, 480px"
              className="qassa-zoom object-cover"
            />
            <span
              className={`qassa-accordion-caption absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-start text-sm font-semibold ${template.chip}`}
            >
              {t("galleryView")}
              <span className="opacity-70" dir="ltr">
                {index + 1}/{urls.length}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Touch: the same images as a swipeable strip. */}
      <div className="qassa-snapper -mx-6 flex gap-3 overflow-x-auto px-6 pb-2 lg:hidden">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            aria-label={caption(index)}
            onClick={() => openLightbox(index)}
            className={`qassa-card relative aspect-4/3 w-[78vw] shrink-0 overflow-hidden rounded-2xl border sm:w-72 ${template.panel}`}
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="(max-width: 640px) 78vw, 288px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={caption(lightbox)}
          className="fixed inset-0 z-50 bg-black/90 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("galleryClose")}
            onClick={close}
            className="absolute inset-0 size-full cursor-zoom-out"
          />
          <div className="relative flex h-full flex-col items-center justify-center gap-4">
            {/* Keyed by photo so every arrow press replays the entrance. */}
            <div
              key={urls[lightbox]}
              className="qassa-slide-in relative aspect-4/3 w-full max-w-5xl shrink-0"
            >
              <Image
                src={urls[lightbox]}
                alt={caption(lightbox)}
                fill
                sizes="100vw"
                className="rounded-2xl object-contain"
              />
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label={t("galleryPrevious")}
                onClick={() =>
                  setLightbox((index) =>
                    index === null ? index : (index - 1 + urls.length) % urls.length,
                  )
                }
                className="inline-flex size-12 items-center justify-center rounded-full border border-white/40 text-xl text-white transition hover:bg-white/15"
              >
                ‹
              </button>
              <span className="text-sm text-white/80" dir="ltr">
                {lightbox + 1} / {urls.length}
              </span>
              <button
                type="button"
                aria-label={t("galleryNext")}
                onClick={() =>
                  setLightbox((index) =>
                    index === null ? index : (index + 1) % urls.length,
                  )
                }
                className="inline-flex size-12 items-center justify-center rounded-full border border-white/40 text-xl text-white transition hover:bg-white/15"
              >
                ›
              </button>
              <button
                type="button"
                autoFocus
                onClick={close}
                className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                {t("galleryClose")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
