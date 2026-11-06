"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ShopTemplate } from "@/lib/shops/templates";

const SLIDE_MS = 5200;
const MAX_SLIDES = 6;

type Props = {
  shopName: string;
  description: string | null;
  city: string | null;
  phone: string | null;
  templateName: string;
  logoUrl: string | null;
  coverUrl: string | null;
  galleryUrls: string[];
  serviceCount: number;
  lowestPriceTnd: number | null;
  locale: string;
  template: ShopTemplate;
};

export function StorefrontHero({
  shopName,
  description,
  city,
  phone,
  templateName,
  logoUrl,
  coverUrl,
  galleryUrls,
  serviceCount,
  lowestPriceTnd,
  locale,
  template,
}: Props) {
  const t = useTranslations("discover");
  const slides = useMemo(() => {
    const seen = new Set<string>();
    return [coverUrl, ...galleryUrls]
      .filter((url): url is string => Boolean(url))
      .filter((url) => (seen.has(url) ? false : (seen.add(url), true)))
      .slice(0, MAX_SLIDES);
  }, [coverUrl, galleryUrls]);

  const [active, setActive] = useState(0);
  const hasPhotos = slides.length > 0;

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setActive((current) => (current + 1) % slides.length);
      }
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const priceFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

  return (
    <section
      aria-label={t("heroAria", { name: shopName })}
      className={`relative isolate overflow-hidden rounded-3xl border ${template.panel}`}
    >
      {hasPhotos && (
        <div className="absolute inset-0 -z-10">
          {slides.map((url, index) => (
            <div
              key={url}
              aria-hidden={index !== active}
              className={`absolute inset-0 transition-opacity duration-[1600ms] ease-out ${
                index === active ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 960px"
                priority={index === 0}
                className={index === active ? "qassa-ken-burns object-cover" : "object-cover"}
              />
            </div>
          ))}
          <div className={`absolute inset-0 bg-linear-to-t ${template.scrim}`} />
        </div>
      )}

      <div
        className={`grid gap-8 p-6 sm:p-10 lg:p-14 ${hasPhotos ? "text-[#f7f3ea]" : ""}`}
      >
        <div className="flex items-center gap-4">
          {logoUrl && (
            <span className="relative size-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white/60 sm:size-16">
              <Image src={logoUrl} alt="" fill sizes="64px" className="object-cover" />
            </span>
          )}
          <p
            className={`text-xs font-semibold uppercase tracking-[0.24em] ${
              hasPhotos ? "" : template.accent
            }`}
          >
            QASSA · {templateName}
          </p>
        </div>

        <div className="max-w-2xl">
          <h1
            className={`font-display text-4xl leading-tight font-bold sm:text-5xl lg:text-6xl ${
              hasPhotos ? "drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]" : ""
            }`}
          >
            {shopName}
          </h1>
          {description && (
            <p
              className={`mt-5 text-base leading-8 sm:text-lg ${
                hasPhotos ? "text-white/85" : "opacity-80"
              }`}
            >
              {description}
            </p>
          )}
        </div>

        <ul className="flex flex-wrap gap-2 text-sm">
          {city && (
            <li className={`rounded-full px-4 py-2 ${hasPhotos ? template.chip : template.panel}`}>
              {city}
            </li>
          )}
          {serviceCount > 0 && (
            <li className={`rounded-full px-4 py-2 ${hasPhotos ? template.chip : template.panel}`}>
              {t("heroServices", { count: serviceCount })}
            </li>
          )}
          {lowestPriceTnd !== null && (
            <li className={`rounded-full px-4 py-2 ${hasPhotos ? template.chip : template.panel}`}>
              {t("heroFrom", { price: priceFormatter.format(lowestPriceTnd) })}
            </li>
          )}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="#booking"
            className={`qassa-cta inline-flex min-h-12 items-center justify-center rounded-xl px-7 text-sm font-semibold tracking-wide ${
              hasPhotos ? "bg-white text-[#171918] hover:bg-[#f2eee5]" : template.cta
            }`}
          >
            {t("heroBook")}
          </a>
          {phone && (
            <a
              href={`tel:${phone}`}
              className={`inline-flex min-h-12 items-center justify-center rounded-xl border px-6 text-sm font-semibold ${
                hasPhotos
                  ? "border-white/50 text-white hover:bg-white/15"
                  : template.ghost
              }`}
            >
              {t("heroCall")}
            </a>
          )}
        </div>

        {slides.length > 1 && (
          <div className="flex items-center gap-2" role="tablist" aria-label={t("heroSlides")}>
            {slides.map((url, index) => (
              <button
                key={url}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={t("heroSlideLabel", { index: index + 1, total: slides.length })}
                onClick={() => setActive(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === active ? "w-8 bg-white" : "w-3 bg-white/45 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
