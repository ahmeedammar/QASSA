"use client";

import { useState, useActionState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";
import { StudioActionFeedback } from "@/components/studio/studio-action-feedback";
import { MediaGallery, MediaSlot } from "@/components/studio/media-field";
import { saveShopMedia, type StudioActionState } from "@/lib/actions/studio";
import { MIN_GALLERY_IMAGES } from "@/lib/shops/media";

export type ShopMedia = {
  logo_path: string | null;
  cover_path: string | null;
  gallery_paths: string[];
};

export function ShopMediaEditor({
  shopId,
  shopName,
  media,
}: {
  shopId: string;
  shopName: string;
  media: ShopMedia;
}) {
  const t = useTranslations("studio");
  const [logoPath, setLogoPath] = useState(media.logo_path);
  const [coverPath, setCoverPath] = useState(media.cover_path);
  const [galleryPaths, setGalleryPaths] = useState<string[]>(media.gallery_paths);
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveShopMedia,
    {},
  );

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div>
        <h2 className="font-display text-xl font-semibold">{t("mediaTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("mediaDescription")}</p>
      </div>

      <form action={formAction} className="grid gap-6">
        <input type="hidden" name="shopId" value={shopId} />
        <input type="hidden" name="logoPath" value={logoPath ?? ""} />
        <input type="hidden" name="coverPath" value={coverPath ?? ""} />
        {galleryPaths.map((path) => (
          <input key={path} type="hidden" name="galleryPaths" value={path} />
        ))}

        <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <MediaSlot
            shopId={shopId}
            kind="cover"
            path={coverPath}
            onChange={setCoverPath}
            label={t("mediaCover")}
            aspectClass="aspect-16/9"
            sizes="(max-width: 640px) 100vw, 45vw"
          />
          <MediaSlot
            shopId={shopId}
            kind="logo"
            path={logoPath}
            onChange={setLogoPath}
            label={t("mediaLogo")}
            aspectClass="aspect-square"
            sizes="(max-width: 640px) 50vw, 20vw"
          />
        </div>

        <MediaGallery
          shopId={shopId}
          paths={galleryPaths}
          onChange={setGalleryPaths}
          label={t("mediaGallery")}
        />

        {galleryPaths.length < MIN_GALLERY_IMAGES && (
          <p className="rounded-lg bg-accent/15 px-4 py-3 text-sm text-foreground">
            {t("mediaGalleryRequired", {
              count: MIN_GALLERY_IMAGES - galleryPaths.length,
            })}
          </p>
        )}

        <StudioActionFeedback state={state} />
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary", "md", "justify-self-start")}
        >
          {pending ? t("saving") : t("mediaSave")}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">{t("mediaTips", { name: shopName })}</p>
    </section>
  );
}
