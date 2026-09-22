import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";

type NavigationItem = {
  href: string;
  label: string;
};

type FacultyHeaderProps = {
  title?: string;
  subtitle?: string;
  nav?: NavigationItem[];
};

export function FacultyHeader({
  title = "PUP FOCUS",
  subtitle,
  nav = [],
}: FacultyHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-t-2 border-amber-500 border-b border-amber-500/30 bg-gradient-to-r from-[#5a0000] via-[#480000] to-[#360000] shadow-md backdrop-blur">
      <div className="flex w-full items-center justify-between pl-4 pr-6 py-3">
        <div className="flex items-center gap-3">
          <BrandMark size={38} className="shrink-0" />
          <div className="flex flex-col md:flex-row md:items-center md:gap-2.5 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap leading-tight">{title}</h1>
            {title === "PUP FOCUS" ? (
              <>
                <span className="hidden md:inline-block h-3.5 w-px bg-amber-400/40 shrink-0" aria-hidden="true" />
                <span className="text-[10px] sm:text-xs md:text-sm font-medium text-amber-200/90 tracking-wide leading-tight truncate">
                  Faculty Online Compliance and Uploading System
                </span>
              </>
            ) : subtitle ? (
              <>
                <span className="hidden md:inline-block h-3.5 w-px bg-amber-400/40 shrink-0" aria-hidden="true" />
                <span className="text-[10px] sm:text-xs md:text-sm font-medium text-amber-200/90 tracking-wide leading-tight truncate">
                  {subtitle}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-amber-500/30 bg-[#7a0000]/60 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-[#8d0000] transition-colors shadow-2xs"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <NotificationDrawer />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
