"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UpcomingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/feed?filter=releases");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-5 h-5 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
