interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Controlled search input, styled to match the admin tables. */
export default function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <input
      type="search"
      value={value}
      placeholder={placeholder ?? "Search…"}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder ?? "Search"}
      className="w-full max-w-sm rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
    />
  );
}
