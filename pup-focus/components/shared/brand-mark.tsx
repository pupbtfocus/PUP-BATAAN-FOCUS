import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
  src?: string;
};

export function BrandMark({
  size = 44,
  className,
  src = "/icons/pup-seal.png",
}: BrandMarkProps) {
  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden="true"
    >
      <Image
        src={src}
        alt="PUP logo"
        fill
        sizes={`${size}px`}
        className="rounded-full object-contain mx-auto transition-transform duration-300"
        priority
      />
    </div>
  );
}
