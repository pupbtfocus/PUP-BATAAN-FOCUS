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
          <div className="flex items-center gap-2.5">
            <BrandMark size={44} className="shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-white text-lg sm:text-xl md:text-2xl tracking-tight whitespace-nowrap leading-tight">
                PUP FOCUS
              </span>
              <span className="md:hidden text-[10px] font-medium text-amber-200/90 tracking-wide leading-tight truncate max-w-[160px] sm:max-w-[200px]">
                Faculty Online Compliance and Uploading System
              </span>
            </div>
          </div>
        </div>

        {/* Centered System Title for Desktop */}
        <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none px-4">
          <span className="text-xs lg:text-sm xl:text-base font-semibold text-amber-200/95 tracking-wide text-center truncate max-w-[48vw]">
            Faculty Online Compliance and Uploading System
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
            <aside className="relative w-72 max-w-[85%] bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 h-full p-4 flex flex-col justify-between z-10 shadow-2xl">
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
