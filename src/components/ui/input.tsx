import { cn } from "@/lib/utils";

export function inputClasses(className?: string): string {
  return cn(
    "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none",
    className,
  );
}
