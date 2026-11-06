import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { publicMediaUrl } from "@/lib/shops/media";
import { SHOP_TEMPLATES } from "@/lib/shops/templates";
import type { PublicShop } from "@/lib/shops/marketplace";

type ShopCardProps = {
  shop: PublicShop;
  closedToday: boolean;
};

export async function ShopCard({ shop, closedToday }: ShopCardProps) {
  const t = await getTranslations("discover");
  const coverUrl = publicMediaUrl(shop.cover_path);
  const template = SHOP_TEMPLATES[shop.template_id];
  const location = [shop.city, shop.address].filter(Boolean).join(" · ");

  return (
    <article className="qassa-card group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <span className="qassa-sheen relative block aspect-4/3 overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="qassa-zoom object-cover"
          />
        ) : (
          <span
            className={`flex size-full items-center justify-center px-4 text-center font-display text-sm font-semibold tracking-[0.22em] ${template.preview}`}
          >
            QASSA · {t(`templates.${template.label}`)}
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent"
        />
        {shop.city && (
          <span className="absolute top-3 start-3 rounded-full bg-black/35 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm">
            {shop.city}
          </span>
        )}
        {closedToday && (
          <span className="absolute bottom-3 start-3 inline-flex items-center gap-2 rounded-full bg-[#0f1211]/75 px-3 py-1.5 text-xs font-semibold text-[#f2eee5] ring-1 ring-white/20">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#d96a55]" />
            {t("closedToday")}
          </span>
        )}
      </span>

      <div className="relative flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-bold">{shop.name}</h3>
        {location && (
          <p className="mt-2 text-sm text-muted-foreground">{location}</p>
        )}
        {shop.description && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {shop.description}
          </p>
        )}
        <Link
          href={`/shop/${encodeURIComponent(shop.slug)}`}
          className="relative mt-auto inline-flex min-h-11 items-center pt-5 font-semibold text-primary"
        >
          {t("visitShop")}
          <span
            aria-hidden="true"
            className="absolute bottom-3 start-0 h-px w-0 bg-current transition-all duration-500 ease-out group-hover:w-[calc(100%-1.25rem)]"
          />
        </Link>
      </div>
    </article>
  );
}
