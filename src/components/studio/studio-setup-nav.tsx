import { Link } from "@/i18n/navigation";

export type StudioSetupStep = {
  id: string;
  label: string;
  done: boolean;
};

export function StudioSetupNav({
  shopId,
  steps,
  current,
  caption,
  progressLabel,
}: {
  shopId: string;
  steps: StudioSetupStep[];
  current: string;
  caption: string;
  progressLabel: (done: number, total: number) => string;
}) {
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <nav aria-label={caption} className="grid gap-4">
      <div>
        <p className="text-sm font-medium">{progressLabel(doneCount, steps.length)}</p>
        <div
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
        >
          <div
            className="qassa-fill-sheen h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {steps.map((step, index) => {
          const active = step.id === current;
          return (
            <li key={step.id} className="shrink-0">
              <Link
                href={`/studio/${shopId}?step=${step.id}`}
                aria-current={active ? "step" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-ring hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full text-xs ${
                    active
                      ? "bg-primary-foreground/20"
                      : step.done
                        ? "bg-success/15 text-success"
                        : "bg-border text-muted-foreground"
                  }`}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
