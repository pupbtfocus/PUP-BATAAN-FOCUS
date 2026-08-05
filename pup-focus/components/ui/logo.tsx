import React from "react";
import { BrandMark } from "@/components/shared/brand-mark";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 145, className = "" }: LogoProps) {
  const brandMarkSize = Math.round(size * 0.58);

  return (
    <div
      className={`flex items-center justify-center mx-auto text-center w-full mb-4 ${className}`}
    >
      <div
        className="relative flex items-center justify-center rounded-full bg-[#4d0000] p-1.5 shadow-xl border-2 border-[#FBBF24] shrink-0"
        style={{ width: size, height: size }}
      >
        {/* Curved Baybayin & PUP FOCUS text along top & bottom inside border circle */}
        <svg
          className="absolute inset-0 z-20 h-full w-full pointer-events-none overflow-visible"
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Top Arc Path for Baybayin Text */}
            <path
              id="topArc"
              d="M 20,100 A 80,80 0 0,1 180,100"
              fill="none"
            />
            {/* Bottom Arc Path for PUP FOCUS Text */}
            <path
              id="bottomArc"
              d="M 20,100 A 80,80 0 0,0 180,100"
              fill="none"
            />
          </defs>

          {/* Top Arc Baybayin Text */}
          <text
            fill="#FBBF24"
            fontSize="14"
            fontWeight="900"
            letterSpacing="2.5"
            className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
          >
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">
              ᜉᜓᜉ᜔ ᜉᜓᜃᜓᜐ᜔
            </textPath>
          </text>

          {/* Bottom Arc PUP FOCUS Text */}
          <text
            fill="#FBBF24"
            fontSize="13"
            fontWeight="900"
            letterSpacing="2"
            className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
          >
            <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
              PUP FOCUS
            </textPath>
          </text>

          {/* Side Stars on the exact horizontal middle axis (Y=100) */}
          <text
            x="24"
            y="100"
            fill="#FBBF24"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ★
          </text>
          <text
            x="176"
            y="100"
            fill="#FBBF24"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ★
          </text>
        </svg>

        {/* Inner Crest Logo */}
        <BrandMark
          size={brandMarkSize}
          className="shrink-0 drop-shadow-[0_0_20px_rgba(255,215,0,0.35)] rounded-full overflow-hidden object-cover mx-auto"
        />
      </div>
    </div>
  );
}

export default Logo;
