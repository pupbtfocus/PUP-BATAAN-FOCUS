import React from "react";
import { Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export interface ModalHeaderProps {
  /** The icon component to display inside the squircle badge */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  /** Primary title of the modal */
  title: React.ReactNode;
  /** Optional id for the title heading for accessibility */
  titleId?: string;
  /** Optional subtitle or metadata line */
  subtitle?: React.ReactNode;
  /** Optional callback when the close button is clicked */
  onClose?: () => void;
  /** Whether the close button is disabled */
  closeDisabled?: boolean;
  /** Accessible label for the close button */
  closeAriaLabel?: string;
  /** Additional container classes */
  className?: string;
  /** Extra elements (action buttons, badges) to render before the close button */
  children?: React.ReactNode;
}

/**
 * Standard squircle icon badge for modal headers.
 * Neutral slate background, border, and text - matches sidebar styling in light & dark modes.
 */
export function ModalHeaderIcon({
  icon,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}) {
  return (
    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-2xs shrink-0 flex items-center justify-center">
      <AppIcon icon={icon} size="lg" color="default" />
    </div>
  );
}

/**
 * Standard close button for modal headers.
 * Neutral slate background and border - no loud colors, matches sidebar in light & dark modes.
 */
export function ModalCloseButton({
  onClick,
  disabled = false,
  ariaLabel = "Close modal",
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors shrink-0 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      aria-label={ariaLabel}
    >
      <AppIcon icon={Xmark} size="md" color="inherit" />
    </button>
  );
}

/**
 * Reusable modal header component matching the PUP FOCUS design system & sidebar.
 */
export function ModalHeader({
  icon: Icon,
  title,
  titleId,
  subtitle,
  onClose,
  closeDisabled = false,
  closeAriaLabel = "Close modal",
  className = "",
  children,
}: ModalHeaderProps) {
  return (
    <div
      className={`shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-950/50 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <ModalHeaderIcon icon={Icon} />}
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h3>
          ) : (
            title
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {children}
        {onClose && (
          <ModalCloseButton
            onClick={onClose}
            disabled={closeDisabled}
            ariaLabel={closeAriaLabel}
          />
        )}
      </div>
    </div>
  );
}
