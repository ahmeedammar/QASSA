// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../messages/en.json";
import { ShopBooking } from "@/components/booking/shop-booking";
import { CustomerAppointments } from "@/components/booking/customer-appointments";
import { demoShop } from "./fixtures/demo-shop";

vi.mock("@/lib/actions/booking", () => ({
  getAvailableSlots: vi.fn(),
  bookAppointment: vi.fn(),
  cancelCustomerAppointment: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

function renderShopBooking(authenticated = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ShopBooking
        shop={demoShop}
        locale="en"
        today="2026-11-02"
        lastBookableDate="2027-01-01"
        authenticated={authenticated}
        panelClass="border-demo bg-demo"
        accentClass="text-demo"
      />
    </NextIntlClientProvider>,
  );
}

describe("demo shop booking UI", () => {
  it("renders sample services, barber assignments, price, and date bounds", () => {
    renderShopBooking();

    expect(screen.getByRole("heading", { name: "Reserve an appointment" })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Demo haircut/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Demo barber Sami/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Demo barber Youssef/ })).toBeTruthy();
    expect(screen.getByText(/TND/)).toBeTruthy();
    expect(screen.getByLabelText("Date").getAttribute("min")).toBe("2026-11-02");
    expect(screen.getByLabelText("Date").getAttribute("max")).toBe("2027-01-01");
  });

  it("filters barbers when a service is selected", () => {
    renderShopBooking();
    fireEvent.change(screen.getByLabelText("Service"), {
      target: { value: demoShop.services[1].id },
    });

    expect(screen.getAllByRole("option", { name: /Demo barber Sami/ })).toHaveLength(1);
    expect(screen.queryByRole("option", { name: /Demo barber Youssef/ })).toBeNull();
  });

  it("exposes the appointment history link to signed-in customers", () => {
    renderShopBooking();
    expect(screen.getByRole("link", { name: "View my appointments" })).toBeTruthy();
  });

  it("does not offer appointment history to signed-out customers", () => {
    renderShopBooking(false);
    expect(screen.queryByRole("link", { name: "View my appointments" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show available times" })).toBeTruthy();
  });
});

describe("customer appointment cancellation cutoff", () => {
  it("lets customers cancel a future confirmed appointment and not a started one", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CustomerAppointments
          locale="en"
          currentTime="2026-11-02T12:00:00.000Z"
          appointments={[
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
              starts_at: "2026-11-03T08:00:00.000Z",
              ends_at: "2026-11-03T08:30:00.000Z",
              status: "confirmed",
              customer_note: null,
              cancellation_reason: null,
              shop_name: demoShop.name,
              barber_name: demoShop.barbers[0].display_name,
              services: [{ name: "Demo haircut", price_tnd: 18, duration_minutes: 30 }],
            },
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
              starts_at: "2026-11-02T11:00:00.000Z",
              ends_at: "2026-11-02T11:30:00.000Z",
              status: "confirmed",
              customer_note: null,
              cancellation_reason: null,
              shop_name: demoShop.name,
              barber_name: demoShop.barbers[0].display_name,
              services: [{ name: "Demo haircut", price_tnd: 18, duration_minutes: 30 }],
            },
          ]}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Cancel appointment" })).toBeTruthy();
    expect(
      screen.getByText("This appointment has started and can no longer be cancelled online."),
    ).toBeTruthy();
  });
});
