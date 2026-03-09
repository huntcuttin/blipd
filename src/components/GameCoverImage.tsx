"use client";

import { memo, useState } from "react";

interface GameCoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

export default memo(function GameCoverImage({ src, alt, className = "w-full aspect-[16/10] rounded-lg object-cover bg-[#1a1a1a]" }: GameCoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <div className={`${className} flex items-center justify-center`}>
      <span className="text-[#333333] text-[10px]">No image</span>
    </div>
  );
});
