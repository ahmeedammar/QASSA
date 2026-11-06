export const SHOP_MEDIA_BUCKET = "shop-media";

/** Gallery images a storefront needs before it may be published. */
export const MIN_GALLERY_IMAGES = 3;

/** Keep in sync with the trigger in 0015_shop_media.sql. */
export const MAX_GALLERY_IMAGES = 12;

export const UPLOADABLE_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ShopMediaKind = "logo" | "cover" | "gallery" | "avatar";

const UUID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function mediaPathPattern(kind: ShopMediaKind): RegExp {
  return new RegExp(`^${UUID_SEGMENT}/${kind}/${UUID_SEGMENT}\\.(?:webp|jpe?g|png|avif)$`);
}

/** Object name for a fresh upload: {shopId}/{kind}/{random uuid}.{ext}. */
export function newMediaPath(shopId: string, kind: ShopMediaKind, fileType: string): string {
  const extension =
    fileType === "image/png"
      ? "png"
      : fileType === "image/avif"
        ? "avif"
        : fileType === "image/jpeg"
          ? "jpg"
          : "webp";
  return `${shopId}/${kind}/${crypto.randomUUID()}.${extension}`;
}

export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${SHOP_MEDIA_BUCKET}/${path}`;
}
