import type { PublicShopWebsite } from "@/lib/shops/marketplace";

export const demoShop: PublicShopWebsite = {
  id: "c8763e0a-4550-4dd1-9916-0663473a22c1",
  name: "QASSA Demo Barber House",
  slug: "qassa-demo-barber-house",
  city: "Tunis",
  address: "10 Avenue Habib Bourguiba",
  phone: "+216 71 000 000",
  description: "Sample shop fixture for customer booking tests.",
  template_id: "classic_gentleman",
  services: [
    {
      id: "fa9db916-9d6c-4680-8934-bae60848f9a0",
      name: "Demo haircut",
      description: "Sample 30-minute haircut.",
      duration_minutes: 30,
      price_tnd: 18,
    },
    {
      id: "a1c9d125-7e89-4bf7-a5ae-28688127e5c4",
      name: "Demo beard trim",
      description: null,
      duration_minutes: 20,
      price_tnd: 10,
    },
  ],
  barbers: [
    {
      id: "7d0bc6bd-860d-4c54-9fb5-cdc5fc5017e8",
      display_name: "Demo barber Sami",
      bio: "Sample barber profile.",
      serviceIds: [
        "fa9db916-9d6c-4680-8934-bae60848f9a0",
        "a1c9d125-7e89-4bf7-a5ae-28688127e5c4",
      ],
    },
    {
      id: "20a2236a-ce88-49d4-ae8a-090a52c9e6d3",
      display_name: "Demo barber Youssef",
      bio: null,
      serviceIds: ["fa9db916-9d6c-4680-8934-bae60848f9a0"],
    },
  ],
  businessHours: [
    {
      id: "b2fd88d2-5c66-49cf-842c-976e0cbdf48d",
      weekday: 1,
      opens_at: "09:00:00",
      closes_at: "18:00:00",
    },
  ],
};

export const demoAvailableSlots = [
  "2026-11-03T09:00:00+00:00",
  "2026-11-03T09:15:00+00:00",
];
