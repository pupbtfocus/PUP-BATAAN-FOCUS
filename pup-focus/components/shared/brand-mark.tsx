import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 44, className }: BrandMarkProps) {
  return (
    <div
      className={`relative ${className ?? ""}`}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden="true"
    >
      <Image
        src="/icons/Untitled - July 24, 2026 at 22.05.24.png"
        alt="PUP FOCUS logo"
        fill
        sizes={`${size}px`}
        className="object-contain p-0"
        priority
      />
    </div>
  );
}
