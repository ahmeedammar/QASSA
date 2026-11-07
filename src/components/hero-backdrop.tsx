"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

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

/**
 * The barber clip behind the Discover and landing heroes, shared so both
 * pages fade, crop and pause it identically. Reduced-motion visitors get the
 * animated gradient instead of the clip.
 */
export function HeroBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    <>
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
    </>
  );
}
