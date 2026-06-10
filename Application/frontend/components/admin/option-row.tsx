"use client";

import { useState } from "react";

import type { AdminItemOption } from "@/lib/api/admin-options";

type Props = {
  option: AdminItemOption;
  busy: boolean;
  onCommit: (patch: { name?: string; description?: string; price_delta_vnd?: number }) => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
};

const inputCls =
  "rounded-lg border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

export function OptionRow({ option, busy, onCommit, onToggle, onDelete }: Props) {
  const [name, setName] = useState(option.name);
  const [description, setDescription] = useState(option.description ?? "");
  const [delta, setDelta] = useState(String(option.price_delta_vnd));
  const [confirming, setConfirming] = useState(false);

  function commit() {
    const patch: { name?: string; description?: string; price_delta_vnd?: number } = {};
    const trimmed = name.trim();
    if (trimmed && trimmed !== option.name) patch.name = trimmed;
    else if (!trimmed) setName(option.name); // revert empty input
    if (description !== (option.description ?? "")) patch.description = description;
    const parsed = Number(delta);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== option.price_delta_vnd) {
      patch.price_delta_vnd = parsed;
    } else if (!Number.isFinite(parsed) || parsed < 0) {
      setDelta(String(option.price_delta_vnd)); // revert invalid input
    }
    if (Object.keys(patch).length > 0) onCommit(patch);
  }

  return (
    <li
      className={`flex flex-wrap items-center gap-2 py-2 ${option.enabled ? "" : "opacity-50"}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={option.enabled}
        aria-label={option.name}
        disabled={busy}
        onClick={() => onToggle(!option.enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          option.enabled ? "bg-brand" : "bg-surface-active"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
            option.enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <input
        aria-label={`${option.name} name`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        className={`w-36 ${inputCls}`}
      />
      <input
        aria-label={`${option.name} description`}
        value={description}
        placeholder="Description"
        onChange={(e) => setDescription(e.target.value)}
        onBlur={commit}
        className={`min-w-0 flex-1 ${inputCls}`}
      />
      <input
        aria-label={`${option.name} price delta`}
        type="number"
        min={0}
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        onBlur={commit}
        className={`w-28 ${inputCls}`}
      />
      {confirming ? (
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded bg-danger-solid px-2.5 py-1 text-xs font-medium text-on-brand hover:opacity-90 disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-subtle"
        >
          Delete
        </button>
      )}
    </li>
  );
}
