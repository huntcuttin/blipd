"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RadarSpinner from "@/components/RadarSpinner";

export default function UpcomingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/feed");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <RadarSpinner size={20} />
    </div>
  );
}
