"use client";

import React, { useState } from "react";
import { Menu, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { SidebarContent } from "@/components/sidebar";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";
import { HighlightedSystemTitle } from "@/components/shared/highlighted-system-title";

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
      <header className="relative w-full bg-gradient-to-r from-[#5a0000] via-[#480000] to-[#360000] border-t-2 border-amber-500 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between shrink-0 z-40 shadow-md">
        <div className="flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden inline-flex items-center justify-center p-1.5 rounded-xl border border-amber-500/30 bg-[#7a0000]/70 hover:bg-[#8d0000] hover:border-amber-400/50 text-amber-100 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-2xs"
            aria-label="Open Navigation Menu"
          >
            <AppIcon icon={Menu} size="lg" color="inherit" />
          </button>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 mr-2">
            <BrandMark size={40} className="shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="hidden md:block font-extrabold text-white text-lg sm:text-xl md:text-2xl tracking-tight whitespace-nowrap leading-tight">
                PUP FOCUS
              </span>
              <span className="md:hidden text-[10px] font-medium text-white tracking-wide leading-tight line-clamp-2">
                <HighlightedSystemTitle />
              </span>
            </div>
          </div>
        </div>

        {/* Centered System Title for Desktop */}
        <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none px-4">
          <span className="text-xs lg:text-sm xl:text-base font-semibold text-white tracking-wide text-center truncate max-w-[48vw]">
            <HighlightedSystemTitle />
          </span>
        </div>

        <div className="flex items-center gap-2 z-10">
          <NotificationDrawer />
          <LogoutButton />
        </div>
      </header>

      {/* Body Wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Fixed Sidebar */}
        <aside className="hidden md:flex w-72 flex-col bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 shrink-0 p-3.5 shadow-md">
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
            <aside className="relative w-72 max-w-[85%] bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 h-full p-4 flex flex-col z-10 shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-amber-400/50 mb-2">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <BrandMark size={38} className="shrink-0" />
                  <span className="text-lg font-black tracking-tight text-white leading-tight">
                    PUP FOCUS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shadow-xs shrink-0"
                  aria-label="Close navigation"
                >
                  <AppIcon icon={Xmark} size="md" color="inherit" />
                </button>
              </div>
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
