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
        src="/icons/Untitled - August 03, 2026 at 19.02.38.png"
        alt="PUP FOCUS logo"
        fill
        sizes={`${size}px`}
        className="object-contain p-0"
        priority
      />
    </div>
  );
}
