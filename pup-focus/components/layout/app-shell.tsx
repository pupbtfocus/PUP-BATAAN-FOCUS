"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";
import { AdminNotificationDrawer } from "@/features/notifications/components/admin-notification-drawer";
import { HighlightedSystemTitle } from "@/components/shared/highlighted-system-title";

type NavigationItem = {
  href: string;
  label: string;
};

type AppShellProps = {
  title: string;
  subtitle?: string;
  nav: NavigationItem[];
  children: React.ReactNode;
  fullBleed?: boolean;
  showNotifications?: boolean;
  role?: "admin" | "staff" | "super_admin" | "faculty";
};

export function AppShell({
  title,
  subtitle,
  nav,
  children,
  fullBleed = false,
  showNotifications = true,
  role,
}: AppShellProps) {
  const pathname = usePathname() || "";
  const isStaff =
    role === "admin" ||
    role === "staff" ||
    role === "super_admin" ||
    (!role &&
      (pathname.startsWith("/admin") ||
        pathname.startsWith("/staff") ||
        pathname.startsWith("/super-admin")));
  const mainClassName = fullBleed
    ? "mx-auto flex h-screen w-full max-w-none overflow-hidden px-0 pt-14"
    : "mx-auto w-full max-w-7xl px-6 py-8 pt-24 h-[calc(100vh-6rem)] overflow-hidden";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200">
      <header className="fixed inset-x-0 top-0 h-14 z-40 bg-[#800000] text-white shadow-md flex items-center transition-colors duration-200">
        {/* Continuous bottom amber border (starts at the sidebar's outer edge calc(18rem-4px) to form a seamless 90-degree corner) */}
        <div className={`absolute ${fullBleed ? "left-0 md:left-[calc(18rem-4px)]" : "left-0"} right-0 bottom-0 h-1 bg-amber-500 pointer-events-none`} />

        <div className="relative flex w-full h-full items-center justify-between pl-3 sm:pl-4 pr-3 sm:pr-6">
          {/* Left: Brand aligned with sidebar column (seamless maroon canopy) */}
          <div className={`flex items-center gap-2 sm:gap-2.5 z-10 min-w-0 md:w-64 ${fullBleed ? "pl-11 sm:pl-12 md:pl-0" : ""}`}>
            <BrandMark size={36} className="shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white whitespace-nowrap leading-tight">
                <span className="text-amber-400">PUP</span> FOCUS
              </span>
              <span className="hidden sm:inline-block text-[10px] text-amber-200/80 font-medium tracking-wide truncate">
                Bataan Campus
              </span>
            </div>
          </div>

          {/* Desktop Centered System Title */}
          <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none px-24">
            <span className="text-sm lg:text-base xl:text-[17px] font-semibold tracking-normal text-center truncate max-w-[65vw]">
              {subtitle || <HighlightedSystemTitle />}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 z-10 ml-auto shrink-0">
            <nav className="flex items-center gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 px-3 py-1.5 text-xs font-medium transition-colors shadow-2xs"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {showNotifications &&
              (isStaff ? <AdminNotificationDrawer /> : <NotificationDrawer />)}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
