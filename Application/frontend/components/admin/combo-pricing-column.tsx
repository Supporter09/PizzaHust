"use client";

import { formatVnd } from "@/lib/format";

interface Props {
  componentsTotal: number;
  comboPrice: string;
  onComboPrice: (v: string) => void;
  priceNum: number;
  savings: number;
  validityStart: string;
  onValidityStart: (v: string) => void;
  validityEnd: string;
  onValidityEnd: (v: string) => void;
  status: string | null;
}

export default function ComboPricingColumn({
  componentsTotal,
  comboPrice,
  onComboPrice,
  priceNum,
  savings,
  validityStart,
  onValidityStart,
  validityEnd,
  onValidityEnd,
  status,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold text-fg">Pricing</h2>
        <div className="flex justify-between text-sm text-muted">
          <span>Components total</span>
          <span className="font-medium text-fg">{formatVnd(componentsTotal)}</span>
        </div>
        <div className="mt-3">
          <label htmlFor="combo-price" className="mb-1 block text-sm font-medium text-fg">
            Combo price
          </label>
          <input
            id="combo-price"
            inputMode="numeric"
            value={comboPrice}
            onChange={(e) => onComboPrice(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </div>
        {savings > 0 && priceNum <= componentsTotal && (
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm font-semibold text-fg">
            <span>Customer saves</span>
            <span>{formatVnd(savings)}</span>
          </div>
        )}
        {priceNum > componentsTotal && componentsTotal > 0 && (
          <p className="mt-3 rounded-lg border border-line bg-surface-hover px-3 py-2 text-xs text-muted">
            This combo costs more than its components bought separately. It can still be saved,
            but customers won&apos;t see a savings badge.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold text-fg">Validity</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="valid-start" className="mb-1 block text-sm font-medium text-fg">
              Starts
            </label>
            <input
              id="valid-start"
              type="date"
              value={validityStart}
              onChange={(e) => onValidityStart(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="valid-end" className="mb-1 block text-sm font-medium text-fg">
              Ends
            </label>
            <input
              id="valid-end"
              type="date"
              value={validityEnd}
              onChange={(e) => onValidityEnd(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            />
          </div>
        </div>
        {status && <p className="mt-2 text-xs text-muted">Status: {status}</p>}
      </section>
    </div>
  );
}
