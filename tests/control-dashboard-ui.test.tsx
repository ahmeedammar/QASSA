// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../messages/en.json";
import { ControlDashboard } from "@/components/control/control-dashboard";
import type { ControlShop } from "@/lib/control/types";

vi.mock("@/lib/actions/control", () => ({
  setShopSuspension: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: (props: { href: string; children: React.ReactNode }) => (
    <a href={props.href}>{props.children}</a>
  ),
}));

afterEach(cleanup);

const shops: ControlShop[] = [
  {
    id: "224ddbba-240a-466a-b0c2-9bd5b64ab715",
    name: "Zitouna Barber Club",
    slug: "zitouna-barber-club",
    city: "Tunis",
    is_published: true,
    is_suspended: false,
    suspension_reason: null,
    created_at: "2026-11-01T10:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Medina Cuts",
    slug: "medina-cuts",
    city: "Sfax",
    is_published: false,
    is_suspended: false,
    suspension_reason: null,
    created_at: "2026-10-20T10:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Corniche Barber",
    slug: "corniche-barber",
    city: "Sousse",
    is_published: true,
    is_suspended: true,
    suspension_reason: "Unverified business licence",
    created_at: "2026-09-05T10:00:00.000Z",
  },
];

function renderDashboard(canSuspend = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ControlDashboard
        shops={shops}
        locale="en"
        canSuspend={canSuspend}
        truncated={false}
      />
    </NextIntlClientProvider>,
  );
}

describe("Control dashboard", () => {
  it("counts shops by state and lists every shop by default", () => {
    renderDashboard();

    expect(screen.getByRole("button", { name: "Total shops: 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Published: 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unpublished: 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Suspended: 1" })).toBeTruthy();
    expect(screen.getByText("3 shops shown · 3 total")).toBeTruthy();
    for (const shop of shops) {
      expect(screen.getByRole("heading", { name: shop.name })).toBeTruthy();
    }
  });

  it("filters to suspended shops from the KPI tile and keeps the reason visible", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Suspended: 1" }));

    expect(screen.getByRole("heading", { name: "Corniche Barber" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Zitouna Barber Club" })).toBeNull();
    expect(screen.getByText(/Unverified business licence/)).toBeTruthy();
    expect(screen.getByText("1 shop shown · 3 total")).toBeTruthy();
    // A suspended shop is restored, not suspended again.
    expect(screen.getByRole("button", { name: "Restore shop" })).toBeTruthy();
  });

  it("searches name, slug and city and reports an empty result set", () => {
    renderDashboard();
    const search = screen.getByRole("searchbox", { name: "Search shops" });

    fireEvent.change(search, { target: { value: "sfax" } });
    expect(screen.getByRole("heading", { name: "Medina Cuts" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Corniche Barber" })).toBeNull();

    fireEvent.change(search, { target: { value: "medina-cuts" } });
    expect(screen.getByRole("heading", { name: "Medina Cuts" })).toBeTruthy();

    fireEvent.change(search, { target: { value: "nowhere" } });
    expect(screen.getByText("No shops match your search.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Medina Cuts" })).toBeNull();
  });

  it("sorts by name when asked and hides mutations from read-only admins", () => {
    renderDashboard(false);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "name" } });
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((node) => node.textContent);
    expect(headings).toEqual(["Corniche Barber", "Medina Cuts", "Zitouna Barber Club"]);

    expect(screen.queryByRole("button", { name: "Suspend shop" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Restore shop" })).toBeNull();
    expect(screen.getByText(/Read-only/)).toBeTruthy();
  });

  it("warns when the platform list hit its row cap", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ControlDashboard shops={shops} locale="en" canSuspend truncated />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/Showing the 100 most recent shops/)).toBeTruthy();
  });
});