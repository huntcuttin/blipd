import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-[#444444]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-[#666666] text-sm mb-6 max-w-[260px]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/home"
        className="px-6 py-3 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm hover:shadow-[0_0_16px_#00ff8855] transition-all"
      >
        Back to Home
      </Link>
    </div>
  );
}
