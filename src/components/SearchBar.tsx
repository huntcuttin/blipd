"use client";

import { useState, useRef, useEffect } from "react";

export default function SearchBar({
  placeholder = "Search games...",
  value,
  onChange,
}: {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  if (!expanded && !value) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label="Search games"
        className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#111111] border border-[#222222] hover:border-[#333333] transition-all"
      >
        <SearchIcon className="w-4 h-4 text-[#666666]" />
      </button>
    );
  }

  return (
    <div className="relative w-60 max-w-[60vw]">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" aria-hidden="true" />
      <label htmlFor="search-games" className="sr-only">Search games</label>
      <input
        id="search-games"
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value) setExpanded(false);
        }}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#111111] border border-[#222222] text-white text-sm placeholder:text-[#666666] focus:outline-none focus:border-[#00ff88] focus:shadow-[0_0_12px_#00ff8844] transition-all"
      />
      {value && (
        <button
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-white"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function SearchIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
