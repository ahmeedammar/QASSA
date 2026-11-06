"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const HERO_VIDEO_SMALL = "/media/barber-loop-360.mp4";
const HERO_VIDEO_LARGE = "/media/barber-loop-720.mp4";
const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotionQuery(onChange: () => void) {
  const query = window.matchMedia(REDUCE_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readMotionQuery() {
  return window.matchMedia(REDUCE_MOTION).matches;
}

type DiscoverHeroProps = {
  search: string;
  city: string;
  cities: string[];
  shopCount: number;
};

export function DiscoverHero({
  search,
  city,
  cities,
  shopCount,
}: DiscoverHeroProps) {
  const t = useTranslations("discover");
  const videoRef = useRef<HTMLVideoElement>(null);
  // Reduced-motion visitors get the animated gradient instead of the clip.
  const showVideo = !useSyncExternalStore(
    subscribeMotionQuery,
    readMotionQuery,
    () => false,
  );

  // The clip fades in through CSS; this only keeps a hidden tab from
  // decoding a background video nobody is watching.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") video.pause();
      else void video.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [showVideo]);

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-30 bg-[#0f1211]" />
      {showVideo && (
        <video
          ref={videoRef}
          aria-hidden="true"
          className="qassa-hero-video absolute inset-0 -z-20 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
        >
          <source media="(max-width: 768px)" src={HERO_VIDEO_SMALL} type="video/mp4" />
          <source src={HERO_VIDEO_LARGE} type="video/mp4" />
        </video>
      )}
      {!showVideo && (
        <div aria-hidden="true" className="qassa-aurora absolute inset-0 -z-20" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-b from-[#0f1211]/85 via-[#0f1211]/55 to-[#0f1211]/80"
      />

      <div className="mx-auto max-w-6xl px-6 pt-16 pb-14 sm:px-8 sm:pt-24 lg:pt-28">
        <p
          className="qassa-slide-in text-sm font-semibold uppercase tracking-[0.24em] text-[#b89b70]"
          style={{ animationDelay: "40ms" }}
        >
          QASSA · قصّة
        </p>
        <h1
          className="qassa-slide-in mt-4 max-w-3xl font-display text-4xl leading-[1.06] font-bold text-[#f7f3ea] drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl"
          style={{ animationDelay: "120ms" }}
        >
          {t("title")}
        </h1>
        <p
          className="qassa-slide-in mt-5 max-w-2xl text-base leading-8 text-white/85 sm:text-lg"
          style={{ animationDelay: "200ms" }}
        >
          {t("description")}
        </p>
        {shopCount > 0 && (
          <p
            className="qassa-slide-in mt-6 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-sm"
            style={{ animationDelay: "260ms" }}
          >
            <span className="relative flex size-2">
              <span className="qassa-ping absolute inline-flex size-full rounded-full bg-[#c5b99f]" />
              <span className="relative inline-flex size-2 rounded-full bg-[#c5b99f]" />
            </span>
            {t("results", { count: shopCount })}
          </p>
        )}

        <form
          action=""
          method="get"
          className="qassa-slide-in mt-9 grid gap-4 rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_28px_60px_-40px_rgba(0,0,0,0.9)] backdrop-blur-md sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end"
          style={{ animationDelay: "320ms" }}
        >
          <label className="grid gap-2 text-sm font-medium text-white/90">
            {t("searchLabel")}
            <input
              type="search"
              name="q"
              defaultValue={search}
              maxLength={80}
              placeholder={t("searchPlaceholder")}
              className="h-12 rounded-xl border border-white/25 bg-white/95 px-4 font-normal text-[#171918]"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-white/90">
            {t("cityLabel")}
            <input
              type="text"
              name="city"
              defaultValue={city}
              maxLength={80}
              placeholder={t("cityPlaceholder")}
              className="h-12 rounded-xl border border-white/25 bg-white/95 px-4 font-normal text-[#171918]"
            />
          </label>
          <button
            type="submit"
            className="qassa-cta h-12 rounded-xl bg-[#f2eee5] px-7 text-sm font-semibold tracking-wide text-[#171918]"
          >
            {t("searchButton")}
          </button>
        </form>

        {cities.length > 0 && (
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <span className="me-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              {t("citiesLabel")}
            </span>
            {cities.map((option) => {
              const isActive = option.toLowerCase() === city.toLowerCase();
              return (
                <Link
                  key={option}
                  href={{ pathname: "/discover", query: { city: option } }}
                  scroll={false}
                  aria-current={isActive ? "true" : undefined}
                  className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-all duration-300 hover:-translate-y-0.5 ${
                    isActive
                      ? "bg-[#f2eee5] text-[#171918] ring-[#f2eee5]"
                      : "bg-white/10 text-white ring-white/30 hover:bg-white/20"
                  }`}
                >
                  {option}
                </Link>
              );
            })}
            {city && (
              <Link
                href="/discover"
                scroll={false}
                className="min-h-10 rounded-full px-4 py-2 text-sm font-medium text-white/80 underline decoration-white/40 underline-offset-4 hover:text-white"
              >
                {t("allCities")}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
