import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export { parseMarketplaceFilter, parseMarketplacePage } from "./filters";

const publicShopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  description: z.string().nullable(),
  logo_path: z.string().nullable(),
  cover_path: z.string().nullable(),
  gallery_paths: z.array(z.string()),
  template_id: z.enum([
    "royal_gold",
    "urban_cut",
    "classic_gentleman",
    "minimal_studio",
    "dark_prestige",
  ]),
});

const publicServiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number().int().positive(),
  price_tnd: z.number().nonnegative(),
});

const publicBarberSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  bio: z.string().nullable(),
  avatar_path: z.string().nullable(),
});

const publicHoursSchema = z.object({
  id: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  opens_at: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  closes_at: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
});

const publicAssignmentSchema = z.object({
  barber_id: z.string().uuid(),
  service_id: z.string().uuid(),
});

export type PublicShop = z.infer<typeof publicShopSchema>;
export type PublicShopWebsite = PublicShop & {
  services: z.infer<typeof publicServiceSchema>[];
  barbers: (z.infer<typeof publicBarberSchema> & { serviceIds: string[] })[];
  businessHours: z.infer<typeof publicHoursSchema>[];
};

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export const MARKETPLACE_PAGE_SIZE = 12;

const SHOP_COLUMNS =
  "id, name, slug, city, address, phone, description, logo_path, cover_path, gallery_paths, template_id";

export async function listPublicShops({
  search,
  city,
  page,
}: {
  search: string;
  city: string;
  page: number;
}) {
  const supabase = await createClient();
  const start = (page - 1) * MARKETPLACE_PAGE_SIZE;
  let request = supabase
    .from("public_barbershops")
    .select(SHOP_COLUMNS, { count: "exact" })
    .order("name", { ascending: true })
    .range(start, start + MARKETPLACE_PAGE_SIZE - 1);

  if (search) {
    request = request.ilike("name", `%${escapeLikePattern(search)}%`);
  }
  if (city) {
    request = request.ilike("city", escapeLikePattern(city));
  }

  const { data, error, count } = await request;
  if (error) {
    console.error("Failed to load public marketplace shops", error);
    return { ok: false as const };
  }

  const parsedShops = z.array(publicShopSchema).safeParse(data ?? []);
  if (!parsedShops.success) {
    console.error("Marketplace returned invalid public shop data", parsedShops.error);
    return { ok: false as const };
  }

  return { ok: true as const, shops: parsedShops.data, count: count ?? 0 };
}

export const getPublicShopBySlug = cache(
  async (
    slug: string,
  ): Promise<{ ok: true; shop: PublicShopWebsite | null } | { ok: false }> => {
    if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) {
      return { ok: true, shop: null };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("public_barbershops")
      .select(SHOP_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Failed to load public shop website", error);
      return { ok: false };
    }
    if (!data) return { ok: true, shop: null };

    const parsedShop = publicShopSchema.safeParse(data);
    if (!parsedShop.success) {
      console.error("Marketplace returned invalid public shop data", parsedShop.error);
      return { ok: false };
    }

    const [servicesResult, barbersResult, assignmentsResult, hoursResult] =
      await Promise.all([
        supabase
          .from("shop_services")
          .select("id, name, description, duration_minutes, price_tnd")
          .eq("shop_id", parsedShop.data.id)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("barbers")
          .select("id, display_name, bio, avatar_path")
          .eq("shop_id", parsedShop.data.id)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("display_name", { ascending: true }),
        supabase
          .from("barber_services")
          .select("barber_id, service_id")
          .eq("shop_id", parsedShop.data.id),
        supabase
          .from("shop_business_hours")
          .select("id, weekday, opens_at, closes_at")
          .eq("shop_id", parsedShop.data.id)
          .order("weekday", { ascending: true })
          .order("opens_at", { ascending: true }),
      ]);

    const dataError = [
      servicesResult.error,
      barbersResult.error,
      assignmentsResult.error,
      hoursResult.error,
    ].find(Boolean);
    if (dataError) {
      console.error("Failed to load public shop details", dataError);
      return { ok: false };
    }

    const services = z
      .array(publicServiceSchema)
      .safeParse(servicesResult.data ?? []);
    const barbers = z.array(publicBarberSchema).safeParse(barbersResult.data ?? []);
    const assignments = z
      .array(publicAssignmentSchema)
      .safeParse(assignmentsResult.data ?? []);
    const businessHours = z
      .array(publicHoursSchema)
      .safeParse(hoursResult.data ?? []);
    if (
      !services.success ||
      !barbers.success ||
      !assignments.success ||
      !businessHours.success
    ) {
      console.error("Marketplace returned invalid public shop details", {
        services: services.success ? null : services.error,
        barbers: barbers.success ? null : barbers.error,
        assignments: assignments.success ? null : assignments.error,
        businessHours: businessHours.success ? null : businessHours.error,
      });
      return { ok: false };
    }

    const serviceIdsByBarber = new Map<string, string[]>();
    for (const assignment of assignments.data) {
      const serviceIds = serviceIdsByBarber.get(assignment.barber_id) ?? [];
      serviceIds.push(assignment.service_id);
      serviceIdsByBarber.set(assignment.barber_id, serviceIds);
    }

    return {
      ok: true,
      shop: {
        ...parsedShop.data,
        services: services.data,
        barbers: barbers.data.map((barber) => ({
          ...barber,
          serviceIds: serviceIdsByBarber.get(barber.id) ?? [],
        })),
        businessHours: businessHours.data,
      },
    };
  },
);
