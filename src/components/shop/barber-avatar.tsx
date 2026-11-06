import Image from "next/image";

function initials(name: string): string {
  return (
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

/** Barber portraits are optional in the Studio, so a monogram carries the slot. */
export function BarberAvatar({
  name,
  url,
  alt,
}: {
  name: string;
  url: string | null;
  alt: string;
}) {
  if (!url) {
    return (
      <span
        aria-hidden="true"
        className="grid aspect-3/4 w-full place-items-center rounded-2xl bg-linear-to-br from-primary/25 to-primary/5 font-display text-2xl font-bold text-primary"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span className="relative block aspect-3/4 w-full overflow-hidden rounded-2xl">
      <Image
        src={url}
        alt={alt}
        fill
        sizes="(max-width: 640px) 40vw, 260px"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </span>
  );
}
