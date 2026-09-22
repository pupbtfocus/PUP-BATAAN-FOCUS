import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 115, className = "" }: LogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/icons/pup-seal.png"
        alt="PUP Logo"
        fill
        sizes={`${size}px`}
        className="object-contain mx-auto"
        priority
      />
    </div>
  );
}

export default Logo;
