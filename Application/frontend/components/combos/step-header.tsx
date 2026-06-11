import type { SlotProgress } from "@/lib/combo-selections";

type Props = {
  number: number;
  title: string;
  progress?: SlotProgress;
};

export function StepHeader({ number, title, progress }: Props) {
  return (
    <h2 className="flex flex-wrap items-center gap-2.5 text-base font-semibold text-fg">
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand"
      >
        {number}
      </span>
      {title}
      {progress ? (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            progress.complete
              ? "bg-success-subtle text-success"
              : "bg-surface-active text-muted"
          }`}
        >
          {progress.picked} of {progress.total} selected
        </span>
      ) : null}
    </h2>
  );
}
