import type { AllowedFormat } from "@/features/requirement-templates/types/requirement-template.types";

interface FormatIconProps {
  format: AllowedFormat | string;
  className?: string;
}

export function FormatIcon({ format, className = "h-5 w-5" }: FormatIconProps) {
  const upper = (format || "").toUpperCase();

  switch (upper) {
    case "PDF":
      return (
        <img
          src="/icons/adobe-pdf.svg"
          alt="Adobe PDF"
          className={`${className} object-contain select-none`}
        />
      );
    case "DOCX":
    case "DOC":
    case "WORD":
      return (
        <img
          src="/icons/microsoft-word.svg"
          alt="Microsoft Word"
          className={`${className} object-contain select-none`}
        />
      );
    case "XLSX":
    case "XLS":
    case "EXCEL":
      return (
        <img
          src="/icons/microsoft-excel.svg"
          alt="Microsoft Excel"
          className={`${className} object-contain select-none`}
        />
      );
    case "PNG":
      return (
        <svg className={`${className} object-contain select-none`} viewBox="0 0 32 32" fill="none">
          <rect width="28" height="28" x="2" y="2" rx="6" fill="#0EA5E9" />
          <circle cx="10" cy="11" r="2.5" fill="#BAE6FD" />
          <path d="M5 24L12 16L16 20L20 15L27 24H5Z" fill="#F0F9FF" />
          <rect x="15" y="4" width="13" height="8" rx="2" fill="#0284C7" />
          <text
            x="21.5"
            y="10.2"
            textAnchor="middle"
            fontSize="6"
            fontWeight="bold"
            fill="white"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            PNG
          </text>
        </svg>
      );
    case "JPG":
    case "JPEG":
      return (
        <svg className={`${className} object-contain select-none`} viewBox="0 0 32 32" fill="none">
          <rect width="28" height="28" x="2" y="2" rx="6" fill="#8B5CF6" />
          <circle cx="10" cy="11" r="2.5" fill="#FDE047" />
          <path d="M5 24L12 16L16 20L20 15L27 24H5Z" fill="#EDE9FE" />
          <rect x="15" y="4" width="13" height="8" rx="2" fill="#6D28D9" />
          <text
            x="21.5"
            y="10.2"
            textAnchor="middle"
            fontSize="6"
            fontWeight="bold"
            fill="white"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            JPG
          </text>
        </svg>
      );
    case "ZIP":
    case "RAR":
    case "7Z":
      return (
        <svg className={`${className} object-contain select-none`} viewBox="0 0 32 32" fill="none">
          <rect width="28" height="28" x="2" y="2" rx="6" fill="#F59E0B" />
          <rect x="14" y="6" width="4" height="2" rx="0.5" fill="#FEF3C7" />
          <rect x="14" y="9" width="4" height="2" rx="0.5" fill="#FEF3C7" />
          <rect x="14" y="12" width="4" height="2" rx="0.5" fill="#FEF3C7" />
          <rect x="13" y="15" width="6" height="5" rx="1.5" fill="#FDE047" stroke="#B45309" strokeWidth="0.6" />
          <path d="M16 20V25" stroke="#B45309" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={`${className} object-contain select-none`} viewBox="0 0 32 32" fill="none">
          <rect width="28" height="28" x="2" y="2" rx="6" fill="#64748B" />
          <path d="M9 10H23M9 15H23M9 20H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

