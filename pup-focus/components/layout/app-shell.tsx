import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";
import { ThemeToggle } from "@/components/shared/theme-toggle";

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <header className="fixed inset-x-0 top-0 h-14 z-50 border-b border-slate-400 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center transition-colors duration-200">
        <div className="flex w-full items-center justify-between pl-12 sm:pl-14 md:pl-4 pr-3 sm:pr-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <BrandMark
              size={32}
              className="shrink-0 rounded-full ring-2 ring-amber-500/40"
            />
            <div>
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-wide text-slate-900 dark:text-slate-100 whitespace-nowrap">{title}</h1>
              {subtitle ? (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="flex items-center gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <ThemeToggle />
            {showNotifications && <NotificationDrawer />}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className={mainClassName}>{children}</main>
    </div>
  );
}

