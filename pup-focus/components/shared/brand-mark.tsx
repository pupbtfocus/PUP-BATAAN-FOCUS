import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
  src?: string;
};

export function BrandMark({
  size = 44,
  className,
  src = "/icons/pup-focus-emblem-logo.png",
}: BrandMarkProps) {
  return (
    <div
      className={`relative rounded-full overflow-hidden border-2 border-[#FBBF24] shadow-[0_0_12px_rgba(251,191,36,0.35)] ${className ?? ""}`}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden="true"
    >
      <Image
        src={src}
        alt="PUP FOCUS logo"
        fill
        sizes={`${size}px`}
        className="rounded-full object-cover mx-auto scale-[1.18] rotate-[1.8deg] transition-transform duration-300"
        priority
      />
    </div>
  );
}
