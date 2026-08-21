import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";

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
};

export function AppShell({
  title,
  subtitle,
  nav,
  children,
  fullBleed = false,
  showNotifications = true,
}: AppShellProps) {
  const mainClassName = fullBleed
    ? "mx-auto flex h-screen w-full max-w-none overflow-hidden px-0 pt-14"
    : "mx-auto w-full max-w-7xl px-6 py-8 pt-24 h-[calc(100vh-6rem)] overflow-hidden";

  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 h-14 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur flex items-center">
        <div className="flex w-full items-center justify-between pl-12 sm:pl-14 md:pl-4 pr-3 sm:pr-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <BrandMark
              size={32}
              className="shrink-0 rounded-full ring-2 ring-[#ffd700]/40"
            />
            <div>
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-wide text-[#fff8e7] whitespace-nowrap">{title}</h1>
              {subtitle ? (
                <p className="text-xs sm:text-sm text-[#f3d9b3]">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {showNotifications && <NotificationDrawer />}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
