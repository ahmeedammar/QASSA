// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../messages/en.json";
import { ScheduleEditor } from "@/components/studio/schedule-editor";
import { AvailabilityExceptionsEditor } from "@/components/studio/availability-exceptions-editor";

vi.mock("@/lib/actions/studio", () => ({
  saveShopRestDay: vi.fn(),
  saveBusinessHours: vi.fn(),
  saveBarberSchedule: vi.fn(),
  deleteStudioSchedule: vi.fn(),
  deleteStudioException: vi.fn(),
  saveBarberBreak: vi.fn(),
  saveBarberDayOff: vi.fn(),
}));

afterEach(cleanup);

const SHOP_ID = "c8763e0a-4550-4dd1-9916-0663473a22c1";
const BARBER_ID = "7d0bc6bd-860d-4c54-9fb5-cdc5fc5017e8";

const BARBER = {
  id: BARBER_ID,
  display_name: "Sami",
  bio: null,
  avatar_path: null,
  is_active: true,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function editor(overrides = {}) {
  return renderWithIntl(
    <ScheduleEditor
      shopId={SHOP_ID}
      hours={[{ id: "h1", weekday: 1, opens_at: "09:00:00", closes_at: "18:00:00" }]}
      barbers={[BARBER]}
      schedules={[]}
      restDay={6}
      {...overrides}
    />,
  );
}

function hoursSection() {
  const heading = screen.getByText("Shop opening hours");
  const section = heading.closest("section");
  if (!section) throw new Error("Shop opening hours section is missing");
  return within(section as HTMLElement);
}

function dayOptions(select: Element) {
  return Array.from(select.querySelectorAll("option")).map((option) => option.textContent);
}

describe("studio weekly rest day", () => {
  it("offers all seven days for the rest day and keeps it selected", () => {
    editor();
    const restDaySelect = screen.getByLabelText("Rest day") as HTMLSelectElement;
    expect(restDaySelect.options).toHaveLength(8);
    expect(dayOptions(restDaySelect).slice(1)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(restDaySelect.value).toBe("6");
    expect(
      screen.getByText(
        "By Tunisian law the shop closes one weekday every week. Customers see that day as closed and cannot book it.",
      ),
    ).toBeTruthy();
  });

  it("refuses to add opening hours on the rest day", () => {
    editor();
    const selects = hoursSection().getAllByLabelText("Day of the week");
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(dayOptions(select)).toHaveLength(6);
      expect(dayOptions(select)).not.toContain("Saturday");
    }
  });

  it("still asks for a choice when the shop has no rest day yet", () => {
    editor({ restDay: null });
    const restDaySelect = screen.getByLabelText("Rest day") as HTMLSelectElement;
    expect(restDaySelect.value).toBe("");
    expect(restDaySelect.required).toBe(true);
    const placeholder = screen.getByText("Choose a day").closest("option");
    expect(placeholder?.disabled).toBe(true);
    for (const select of hoursSection().getAllByLabelText("Day of the week"))
      expect(dayOptions(select)).toHaveLength(7);
  });

  it("has no holiday section left in the schedule editor", () => {
    editor();
    expect(screen.queryByText(/holiday/i)).toBeNull();
  });
});

describe("studio availability exceptions", () => {
  it("manages breaks and time off without any holiday section", () => {
    renderWithIntl(
      <AvailabilityExceptionsEditor
        shopId={SHOP_ID}
        barbers={[BARBER]}
        breaks={[]}
        daysOff={[]}
      />,
    );
    expect(screen.getByText("Weekly barber breaks")).toBeTruthy();
    expect(screen.getByText("Barber time off")).toBeTruthy();
    expect(screen.queryByText(/holiday/i)).toBeNull();
  });
});
