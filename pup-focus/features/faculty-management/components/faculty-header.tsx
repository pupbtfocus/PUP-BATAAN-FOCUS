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
      <div className="relative flex w-full items-center justify-between pl-4 pr-6 py-3">
        <div className="flex items-center gap-3 z-10">
          <BrandMark size={44} className="shrink-0" />
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap leading-tight">
              PUP FOCUS
            </h1>
            <span className="md:hidden text-[10px] font-medium text-amber-200/90 tracking-wide leading-tight truncate max-w-[160px] sm:max-w-[200px]">
              {subtitle || "Faculty Online Compliance and Uploading System"}
            </span>
          </div>
        </div>

        {/* Centered System Title for Desktop */}
        <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none px-4">
          <span className="text-xs lg:text-sm xl:text-base font-semibold text-amber-200/95 tracking-wide text-center truncate max-w-[48vw]">
            {title === "PUP FOCUS"
              ? "Faculty Online Compliance and Uploading System"
              : subtitle || null}
          </span>
        </div>

        <div className="flex items-center gap-3 z-10">
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
