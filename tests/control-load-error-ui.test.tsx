// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../messages/en.json";
import { ControlLoadError } from "@/components/control/control-load-error";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: (props: { href: string; children: React.ReactNode }) => (
    <a href={props.href}>{props.children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

function renderError(code: string, detail: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ControlLoadError code={code} detail={detail} />
    </NextIntlClientProvider>,
  );
}

describe("Control load error", () => {
  it("names the missing migration when the RPC is absent from the schema cache", () => {
    renderError("PGRST202", "Could not find the function public.list_platform_shops");

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/0014_platform_shop_suspension\.sql/)).toBeTruthy();
    expect(screen.getByText("PGRST202")).toBeTruthy();
    expect(
      screen.getByText("Could not find the function public.list_platform_shops"),
    ).toBeTruthy();
  });

  it("re-runs the server component instead of leaving the operator stranded", () => {
    renderError("XX000", "connection reset");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/could not return the shop list/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in again" })).toBeTruthy();
  });

  it("points at the session when PostgREST rejected the token", () => {
    renderError("PGRST301", "JWT expired");

    expect(screen.getByText(/Sign in again, then return to QASSA Control/)).toBeTruthy();
  });
});