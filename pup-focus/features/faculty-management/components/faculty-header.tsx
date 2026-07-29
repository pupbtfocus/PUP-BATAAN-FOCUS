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
  title = "PUP Bataan FOCUS",
  subtitle,
  nav = [],
}: FacultyHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(255,215,0,0.18)] bg-[#4d0000]/85 backdrop-blur">
      <div className="flex w-full items-center justify-between pl-4 pr-6 py-4">
        <div className="flex items-center gap-3">
          <BrandMark
            size={42}
            className="shrink-0 rounded-full ring-2 ring-[#ffd700]/40"
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
          <NotificationDrawer />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
