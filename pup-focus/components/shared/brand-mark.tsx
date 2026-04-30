import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 44, className }: BrandMarkProps) {
  return (
    <div
      className={`overflow-hidden rounded-full bg-[#fff8e7]/5 ${className ?? ""}`}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden="true"
    >
      <Image
        src="/icons/pup-seal.png"
        alt="PUP FOCUS logo"
        fill
        sizes={`${size}px`}
        className="object-contain p-0"
        priority
      />
    </div>
  );
}
