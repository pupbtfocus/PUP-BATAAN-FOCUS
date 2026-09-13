import React from "react";

/**
 * AppIcon — Centralized icon component for the PUP FOCUS design system.
 *
 * Provides standardized size tokens (xs → xl), color tokens with automatic
 * light/dark mode support, and consistent shrink-0 flex behavior.
 *
 * Usage:
 *   <AppIcon icon={CheckCircle} size="md" color="success" />
 *   <AppIcon icon={Xmark} size="sm" color="inherit" />
 *   <AppIcon icon={SystemRestart} size="xl" color="active" className="animate-spin" />
 */

// ─── Size Tokens ────────────────────────────────────────────────────────────
export const ICON_SIZE = {
  xs:  "h-3 w-3",       // Tiny inline indicators
  sm:  "h-3.5 w-3.5",   // Small buttons, badges, sidebar sub-items
  md:  "h-4 w-4",       // Default — sidebar main items, modal headers, buttons
  lg:  "h-5 w-5",       // Feature headers, banner icons
  xl:  "h-8 w-8",       // Empty states, loading spinners
} as const;

export type IconSize = keyof typeof ICON_SIZE;

// ─── Color Tokens ───────────────────────────────────────────────────────────
export const ICON_COLOR = {
  default:  "text-slate-600 dark:text-slate-400",
  active:   "text-amber-600 dark:text-amber-400",
  muted:    "text-slate-400 dark:text-slate-500",
  success:  "text-emerald-600 dark:text-emerald-400",
  danger:   "text-[#780000] dark:text-rose-400",
  warning:  "text-amber-600 dark:text-amber-400",
  info:     "text-sky-600 dark:text-sky-400",
  white:    "text-white",
  inherit:  "",   // Inherits from parent (e.g. button text color)
} as const;

export type IconColor = keyof typeof ICON_COLOR;

// ─── Component ──────────────────────────────────────────────────────────────
export interface AppIconProps {
  /** The iconoir-react icon component to render. */
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  /** Predefined size token. Defaults to "md". */
  size?: IconSize;
  /** Predefined color token. Defaults to "default". */
  color?: IconColor;
  /** Extra Tailwind classes (animations, margins, etc.) — merged after tokens. */
  className?: string;
  /** Override stroke width if needed. Defaults to provider value (2). */
  strokeWidth?: number | string;
}

export function AppIcon({
  icon: Icon,
  size = "md",
  color = "default",
  className = "",
  strokeWidth,
}: AppIconProps) {
  const classes = [
    ICON_SIZE[size],
    ICON_COLOR[color],
    "shrink-0",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const extraProps: { strokeWidth?: number | string } = {};
  if (strokeWidth !== undefined) {
    extraProps.strokeWidth = strokeWidth;
  }

  return <Icon className={classes} {...extraProps} />;
}

export default AppIcon;
