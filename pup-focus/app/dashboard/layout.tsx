"use client";

import React, { useState } from "react";
import { Menu } from "lucide-react";
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
    <div className="flex flex-col h-screen w-full bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Consolidated Top Header (All Views) */}
      <header className="w-full bg-gradient-to-r from-[#400000] via-[#2a0000] to-[#1a0000] border-b border-amber-500/20 px-4 py-3 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 text-amber-300 hover:bg-amber-500/10 rounded-xl transition-all"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BrandMark size={28} className="shrink-0" />
            <span className="font-bold text-slate-100 text-sm sm:text-base tracking-wide">
              PUP FOCUS
            </span>
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
        <aside className="hidden md:flex w-56 flex-col bg-[#0d121f] border-r border-slate-800/80 shrink-0 p-2.5">
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
            <aside className="relative w-64 max-w-[80%] bg-[#0d121f] h-full p-3 border-r border-slate-800 flex flex-col justify-between z-10 shadow-2xl">
              <SidebarContent
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#090d16]">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
