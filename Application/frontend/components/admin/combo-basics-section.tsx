"use client";

interface Props {
  name: string;
  onName: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  showImage: boolean;
  imageUrl: string | null;
  onImagePick: (f: File) => void;
  onImageRemove: () => void;
}

export default function ComboBasicsSection({
  name,
  onName,
  description,
  onDescription,
  showImage,
  imageUrl,
  onImagePick,
  onImageRemove,
}: Props) {
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold text-fg">Basics</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="combo-name" className="mb-1 block text-sm font-medium text-fg">
            Combo name
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
        {showImage && (
          <div>
            <span className="mb-2 block text-sm font-medium text-fg">Image</span>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="mb-2 aspect-[16/6] w-full max-w-md rounded-lg object-cover"
              />
            ) : (
              <div className="mb-2 aspect-[16/6] w-full max-w-md rounded-lg bg-surface-hover" />
            )}
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImagePick(f);
                  }}
                />
              </label>
              {imageUrl && (
                <button type="button" onClick={onImageRemove} className="text-sm text-brand">
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
