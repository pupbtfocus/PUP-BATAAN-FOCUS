"use client";

import React, { useState } from "react";
import { Menu } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { SidebarContent } from "@/components/sidebar";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Consolidated Top Header (All Views) */}
      <header className="w-full bg-gradient-to-r from-[#5a0000] via-[#480000] to-[#360000] border-t-2 border-amber-500 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between shrink-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 text-amber-300 hover:bg-amber-500/20 rounded-xl transition-all"
            aria-label="Open Navigation Menu"
          >
            <AppIcon icon={Menu} size="lg" color="inherit" />
          </button>
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} className="shrink-0" />
            <div className="flex flex-col md:flex-row md:items-center md:gap-2.5 min-w-0">
              <span className="font-bold text-white text-sm sm:text-base tracking-tight whitespace-nowrap leading-tight">
                PUP FOCUS
              </span>
              <span className="hidden md:inline-block h-3.5 w-px bg-amber-400/40 shrink-0" aria-hidden="true" />
              <span className="text-[10px] sm:text-xs md:text-sm font-medium text-amber-200/90 tracking-wide leading-tight truncate">
                Faculty Online Compliance and Uploading System
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationDrawer />
          <LogoutButton />
        </div>
      </header>

      {/* Body Wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Fixed Sidebar */}
        <aside className="hidden md:flex w-56 flex-col bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 shrink-0 p-2.5 shadow-md">
          <SidebarContent
            activeSection={activeSection}
            setActiveSection={setActiveSection}
          />
        </aside>

        {/* Mobile Navigation Drawer / Sheet */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="relative w-64 max-w-[80%] bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 h-full p-3 flex flex-col justify-between z-10 shadow-2xl">
              <SidebarContent
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
