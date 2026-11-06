// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../messages/en.json";
import { DiscoverHero } from "@/components/discover/discover-hero";

vi.mock("@/i18n/navigation", () => ({
  Link: (props: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: React.ReactNode;
    scroll?: boolean;
    "aria-current"?: ComponentProps<"a">["aria-current"];
  }) => {
    const href = props.href;
    const url =
      typeof href === "string"
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query).toString()}`;
    return (
      <a href={url} aria-current={props["aria-current"]}>
        {props.children}
      </a>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubMotionPreference(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) =>
    ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList,
  );
}

function renderHero() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DiscoverHero
        search=""
        city="Tunis"
        cities={["Tunis", "Sfax"]}
        shopCount={7}
      />
    </NextIntlClientProvider>,
  );
}

describe("discover hero", () => {
  beforeEach(() => stubMotionPreference(false));

  it("offers the search form, the published count and city quick filters", () => {
    renderHero();

    expect(
      screen.getByRole("heading", { name: "Find your barbershop" }),
    ).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Shop name" })).toBeTruthy();
    expect(screen.getByText("7 shops found")).toBeTruthy();

    const links = screen.getAllByRole("link");
    expect(
      links.some((link) => link.getAttribute("href") === "/discover?city=Sfax"),
    ).toBe(true);
    // The active city stays selected rather than looking like another filter.
    expect(screen.getByRole("link", { name: "Tunis" }).getAttribute("aria-current")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "All cities" })).toBeTruthy();
  });

  it("plays the barber clip when motion is welcome", () => {
    const { container } = renderHero();
    const video = container.querySelector("video");
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(true);
    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources.map((source) => source.getAttribute("src"))).toEqual([
      "/media/barber-loop-360.mp4",
      "/media/barber-loop-720.mp4",
    ]);
    expect(sources[0]?.getAttribute("media")).toBe("(max-width: 768px)");
  });

  it("swaps the clip for the animated gradient when motion is reduced", () => {
    stubMotionPreference(true);
    const { container } = renderHero();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".qassa-aurora")).toBeTruthy();
  });
});
