"use client";

interface Props {
  name: string;
  onName: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
}

export default function ComboBasicsSection({
  name,
  onName,
  description,
  onDescription,
}: Props) {
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold text-fg">Basics</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="combo-name" className="mb-1 block text-sm font-medium text-fg">
            Combo Name <span className="text-brand-fg">*</span>
          </label>
          <input
            id="combo-name"
            value={name}
            onChange={(e) => onName(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="combo-desc" className="mb-1 block text-sm font-medium text-fg">
            Description
          </label>
          <textarea
            id="combo-desc"
            rows={2}
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </div>
      </div>
    </section>
  );
}