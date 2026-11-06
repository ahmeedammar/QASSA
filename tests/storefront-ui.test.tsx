// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import messages from "../messages/en.json";
import { BarberAvatar } from "@/components/shop/barber-avatar";
import { Reveal } from "@/components/shop/reveal";
import { StorefrontGallery } from "@/components/shop/storefront-gallery";
import { StorefrontHero } from "@/components/shop/storefront-hero";
import { SHOP_TEMPLATES } from "@/lib/shops/templates";

const template = SHOP_TEMPLATES.classic_gentleman;
const urls = [
  "https://cdn.example.test/gallery-one.webp",
  "https://cdn.example.test/gallery-two.webp",
  "https://cdn.example.test/gallery-three.webp",
];

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>);
}

describe("storefront hero", () => {
  it("shows the shop, its photos and the booking anchor", () => {
    renderWithIntl(
      <StorefrontHero
        shopName="QASSA Demo Barber House"
        description="Sample shop fixture for customer booking tests."
        city="Tunis"
        phone="+216 71 000 000"
        templateName="Classic Gentleman"
        logoUrl="https://cdn.example.test/logo.webp"
        coverUrl="https://cdn.example.test/cover.webp"
        galleryUrls={urls}
        serviceCount={2}
        lowestPriceTnd={10}
        locale="en"
        template={template}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "QASSA Demo Barber House" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Book now" }).getAttribute("href")).toBe("#booking");
    expect(screen.getByText("Tunis")).toBeTruthy();
    expect(screen.getByText("2 services")).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Salon photos" })).toBeTruthy();
    // The cover plus three gallery shots, capped and de-duplicated.
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("still reads as a shop when the owner uploaded nothing", () => {
    renderWithIntl(
      <StorefrontHero
        shopName="Empty Shop"
        description={null}
        city="Sousse"
        phone="toto"
        templateName="Minimal Studio"
        logoUrl={null}
        coverUrl={null}
        galleryUrls={[]}
        serviceCount={0}
        lowestPriceTnd={null}
        locale="en"
        template={SHOP_TEMPLATES.minimal_studio}
      />,
    );

    expect(screen.getByRole("heading", { name: "Empty Shop" })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("storefront gallery", () => {
  it("opens a lightbox that answers to Escape and the arrow keys", () => {
    renderWithIntl(<StorefrontGallery urls={urls} shopName="My Salon" template={template} />);

    // Each photo is offered twice: the hover accordion and the swipe strip.
    const [accordionPanel] = screen.getAllByRole("button", { name: "Photo 2 of My Salon" });
    fireEvent.click(accordionPanel!);
    expect(screen.getByRole("dialog", { name: "Photo 2 of My Salon" })).toBeTruthy();

    fireEvent.keyDown(window.document, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Photo 3 of My Salon" })).toBeTruthy();

    fireEvent.keyDown(window.document, { key: "ArrowLeft" });
    fireEvent.keyDown(window.document, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog", { name: "Photo 1 of My Salon" })).toBeTruthy();

    // The strip wraps in both directions.
    fireEvent.keyDown(window.document, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog", { name: "Photo 3 of My Salon" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(screen.getByRole("dialog", { name: "Photo 2 of My Salon" })).toBeTruthy();

    fireEvent.keyDown(window.document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.document.body.style.overflow).toBe("");
  });

  it("renders nothing when the shop has no gallery yet", () => {
    const { container } = renderWithIntl(
      <StorefrontGallery urls={[]} shopName="My Salon" template={template} />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("barber photos", () => {
  it("uses the portrait when the owner uploaded one", () => {
    renderWithIntl(
      <BarberAvatar
        name="Demo barber Sami"
        url="https://cdn.example.test/sami.webp"
        alt="Portrait of Demo barber Sami"
      />,
    );
    expect(screen.getByRole("img", { name: "Portrait of Demo barber Sami" })).toBeTruthy();
  });

  it("falls back to a monogram when there is no portrait", () => {
    renderWithIntl(
      <BarberAvatar name="Sami Ben Ali" url={null} alt="Portrait of Sami Ben Ali" />,
    );
    expect(screen.getByText("SB")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps scroll reveals visible without an IntersectionObserver", () => {
    renderWithIntl(
      <Reveal as="section" aria-label="Services">
        <p>Below the fold</p>
      </Reveal>,
    );
    expect(screen.getByText("Below the fold").closest("section")?.className).not.toContain(
      "qassa-reveal",
    );
  });
});
