"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { MAX_GALLERY_IMAGES, publicMediaUrl, type ShopMediaKind } from "@/lib/shops/media";
import { uploadShopMedia } from "@/lib/shops/upload";

type UploadError = "unsupported" | "too_large" | "failed" | "limit";

function useShopUploader(shopId: string, kind: ShopMediaKind) {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);

  const upload = useCallback(
    async (files: File[], limit?: number) => {
      setUploadError(null);
      setBusy(true);
      const paths: string[] = [];
      try {
        for (const file of files) {
          if (limit !== undefined && paths.length >= limit) {
            setUploadError("limit");
            break;
          }
          const result = await uploadShopMedia(file, shopId, kind);
          if (!result.ok) {
            setUploadError(result.reason);
            break;
          }
          paths.push(result.path);
        }
      } finally {
        setBusy(false);
      }
      return paths;
    },
    [kind, shopId],
  );

  return { busy, uploadError, setUploadError, upload };
}

const errorKeys: Record<UploadError, string> = {
  unsupported: "mediaUnsupportedType",
  too_large: "mediaTooLarge",
  failed: "mediaUploadFailed",
  limit: "mediaGalleryLimit",
};

export function MediaSlot({
  shopId,
  kind,
  path,
  onChange,
  label,
  aspectClass,
  sizes,
}: {
  shopId: string;
  kind: ShopMediaKind;
  path: string | null;
  onChange: (path: string | null) => void;
  label: string;
  aspectClass: string;
  sizes: string;
}) {
  const t = useTranslations("studio");
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, uploadError, setUploadError, upload } = useShopUploader(shopId, kind);
  const [dragging, setDragging] = useState(false);
  const preview = publicMediaUrl(path);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const [uploaded] = await upload([...files].slice(0, 1));
    if (uploaded) onChange(uploaded);
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {path && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setUploadError(null);
            }}
            className="text-xs font-medium text-danger underline-offset-4 hover:underline"
          >
            {t("mediaRemove")}
          </button>
        )}
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={`group relative overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
          dragging ? "border-ring bg-primary/10" : "border-border bg-surface"
        } ${aspectClass}`}
      >
        {preview ? (
          <>
            <Image
              src={preview}
              alt=""
              fill
              sizes={sizes}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 bg-linear-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg">
                {t("mediaReplace")}
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-full w-full place-content-center gap-2 px-4 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="mx-auto grid size-10 place-content-center rounded-full border border-border text-primary">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </span>
            {busy ? t("mediaUploading") : t("mediaDropHint")}
          </button>
        )}
        {busy && (
          <span className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-primary" aria-hidden="true" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/webp,image/jpeg,image/png,image/avif"
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {uploadError && (
        <p role="alert" className="text-xs text-danger">
          {t(errorKeys[uploadError])}
        </p>
      )}
    </div>
  );
}

export function MediaGallery({
  shopId,
  paths,
  onChange,
  label,
}: {
  shopId: string;
  paths: string[];
  onChange: (paths: string[]) => void;
  label: string;
}) {
  const t = useTranslations("studio");
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, uploadError, setUploadError, upload } = useShopUploader(shopId, "gallery");
  const [dragging, setDragging] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const uploaded = await upload(
      [...files],
      MAX_GALLERY_IMAGES - paths.length,
    );
    if (uploaded.length) onChange([...paths, ...uploaded]);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= paths.length) return;
    const next = [...paths];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {t("mediaGalleryCount", { count: paths.length, max: MAX_GALLERY_IMAGES })}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {paths.map((path, index) => (
          <li
            key={path}
            className="group relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-surface transition-shadow duration-300 hover:shadow-lg"
          >
            <Image
              src={publicMediaUrl(path) ?? ""}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t("mediaMoveFirst")}
                  className="grid size-8 place-content-center rounded-full bg-card/90 text-foreground shadow disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === paths.length - 1}
                  aria-label={t("mediaMoveLast")}
                  className="grid size-8 place-content-center rounded-full bg-card/90 text-foreground shadow disabled:opacity-40"
                >
                  →
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange(paths.filter((item) => item !== path));
                  setUploadError(null);
                }}
                className="grid size-8 place-content-center rounded-full bg-danger text-danger-foreground shadow"
                aria-label={t("mediaRemove")}
              >
                ×
              </button>
            </div>
            {index === 0 && (
              <span className="absolute start-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                {t("mediaCoverPick")}
              </span>
            )}
          </li>
        ))}

        {paths.length < MAX_GALLERY_IMAGES && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void handleFiles(event.dataTransfer.files);
              }}
              className={`grid aspect-4/3 w-full place-content-center gap-2 rounded-xl border-2 border-dashed px-3 text-center text-sm transition-colors ${
                dragging
                  ? "border-ring bg-primary/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              <span className="mx-auto grid size-10 place-content-center rounded-full border border-current text-primary">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
              {busy ? t("mediaUploading") : t("mediaAddImages")}
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/webp,image/jpeg,image/png,image/avif"
              className="sr-only"
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </li>
        )}
      </ul>

      {uploadError && (
        <p role="alert" className="text-xs text-danger">
          {t(errorKeys[uploadError])}
        </p>
      )}
    </div>
  );
}
