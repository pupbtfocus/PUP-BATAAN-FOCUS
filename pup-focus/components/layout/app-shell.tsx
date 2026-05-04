import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/shared/logout-button";

type NavigationItem = {
  href: string;
  label: string;
};

type AppShellProps = {
  title: string;
  subtitle?: string;
  nav: NavigationItem[];
  children: React.ReactNode;
};

export function AppShell({ title, subtitle, nav, children }: AppShellProps) {
  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(255,215,0,0.18)] bg-[#4d0000]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandMark
              size={42}
              className="shrink-0 rounded-full ring-2 ring-[#ffd700]/40 shadow-lg shadow-black/20"
            />
            <div>
              <h1 className="text-xl font-semibold text-[#fff8e7]">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-[#f3d9b3]">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-[rgba(255,215,0,0.18)] bg-[#6d0000]/60 px-3 py-2 text-sm text-[#fff8e7] hover:bg-[#850000]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {/* account name removed */}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-8 pt-28 h-[calc(100vh-7rem)] overflow-hidden">
        {children}
      </main>
    </div>
  );
}
