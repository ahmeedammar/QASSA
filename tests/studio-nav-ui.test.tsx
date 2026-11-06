// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { StudioSetupNav } from "@/components/studio/studio-setup-nav";

vi.mock("@/i18n/navigation", () => ({
  Link: (props: {
    href: string;
    children: React.ReactNode;
    "aria-current"?: ComponentProps<"a">["aria-current"];
  }) => (
    <a href={props.href} aria-current={props["aria-current"]}>
      {props.children}
    </a>
  ),
}));

afterEach(cleanup);

const STEPS = [
  { id: "services", label: "Services", done: true },
  { id: "team", label: "Team", done: true },
  { id: "hours", label: "Hours", done: false },
  { id: "exceptions", label: "Exceptions", done: false },
  { id: "media", label: "Photos", done: false },
  { id: "site", label: "Website", done: false },
];

function renderNav(current = "team") {
  return render(
    <StudioSetupNav
      shopId="shop-1"
      steps={STEPS}
      current={current}
      caption="Shop setup"
      progressLabel={(done, total) => `${done} of ${total} steps ready`}
    />,
  );
}

describe("studio setup navigation", () => {
  it("counts finished steps in the progress bar", () => {
    renderNav();
    expect(screen.getByText("2 of 6 steps ready")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuemax")).toBe("6");
  });

  it("links every step and marks the one being edited", () => {
    renderNav("hours");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
    expect(links[2]?.getAttribute("aria-current")).toBe("step");
    expect(links[0]?.getAttribute("href")).toBe("/studio/shop-1?step=services");
    expect(links[5]?.getAttribute("href")).toBe("/studio/shop-1?step=site");
  });

  it("keeps the step rail reachable by keyboard", () => {
    renderNav();
    const first = screen.getAllByRole("link")[0];
    first?.focus();
    expect(document.activeElement).toBe(first);
    expect(first?.textContent).toContain("Services");
  });
});
