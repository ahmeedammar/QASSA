// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../messages/en.json";
import { ShopSuspensionList } from "@/components/control/shop-suspension-list";
import { demoShop } from "./fixtures/demo-shop";

vi.mock("@/lib/actions/control", () => ({
  setShopSuspension: vi.fn(),
}));

afterEach(cleanup);

const shops = [
  {
    id: demoShop.id,
    name: demoShop.name,
    slug: demoShop.slug,
    city: demoShop.city,
    is_published: true,
    is_suspended: false,
    suspension_reason: null,
    created_at: "2026-11-01T10:00:00.000Z",
  },
];

describe("Control shop suspension UI", () => {
  it("shows suspend controls to operations staff and hides them from read-only admins", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ShopSuspensionList shops={shops} locale="en" canSuspend />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Suspend shop" })).toBeTruthy();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ShopSuspensionList shops={shops} locale="en" canSuspend={false} />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole("button", { name: "Suspend shop" })).toBeNull();
    expect(screen.getByText(demoShop.name)).toBeTruthy();
  });
});
