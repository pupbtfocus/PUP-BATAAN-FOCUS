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
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Desktop Fixed Sidebar - Full Height to Top */}
      <aside className="hidden md:flex w-72 flex-col bg-[#800000] text-amber-50 border-r-4 border-amber-500 shrink-0 p-3.5 shadow-md h-screen overflow-y-auto z-40">
        <SidebarContent
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
      </aside>

      {/* Main Column: Header + Content */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden min-w-0">
        {/* Consolidated Top Header */}
        <header className="relative w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b-4 border-amber-500 px-4 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-xs h-14">
          <div className="flex items-center gap-3 z-10">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden inline-flex items-center justify-center p-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-2xs"
              aria-label="Open Navigation Menu"
            >
              <AppIcon icon={Menu} size="lg" color="inherit" />
            </button>
            <div className="flex md:hidden items-center gap-2 min-w-0 flex-1">
              <BrandMark size={36} className="shrink-0" />
              <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight whitespace-nowrap leading-tight">
                <span className="text-[#800000] dark:text-amber-500">PUP</span> FOCUS
              </span>
            </div>
          </div>

          {/* Desktop Centered System Title */}
          <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none px-24">
            <span className="text-sm lg:text-base xl:text-[17px] font-semibold tracking-normal text-center truncate max-w-[65vw]">
              <HighlightedSystemTitle />
            </span>
          </div>

          <div className="flex items-center gap-2 z-10 ml-auto shrink-0">
            <NotificationDrawer />
            <LogoutButton />
          </div>
        </header>

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>

      {/* Mobile Navigation Drawer / Sheet */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85%] bg-[#800000] text-amber-50 border-r-4 border-amber-500 h-full p-4 flex flex-col z-10 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <BrandMark size={38} className="shrink-0" />
                <span className="text-lg font-black tracking-tight text-white leading-tight">
                  <span className="text-amber-400">PUP</span> FOCUS
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
              showBrand={false}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
