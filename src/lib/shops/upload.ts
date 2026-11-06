import { createClient } from "@/lib/supabase/client";
import {
  MAX_UPLOAD_BYTES,
  SHOP_MEDIA_BUCKET,
  UPLOADABLE_IMAGE_TYPES,
  newMediaPath,
  type ShopMediaKind,
} from "./media";

export type UploadFailure = "unsupported" | "too_large" | "failed";

export async function uploadShopMedia(
  file: File,
  shopId: string,
  kind: ShopMediaKind,
): Promise<{ ok: true; path: string } | { ok: false; reason: UploadFailure }> {
  if (!UPLOADABLE_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, reason: "unsupported" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  const path = newMediaPath(shopId, kind, file.type);
  const { error } = await createClient()
    .storage.from(SHOP_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("Failed to upload shop media", error);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, path };
}
