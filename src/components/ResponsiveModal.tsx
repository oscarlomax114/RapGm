"use client";
import { ReactNode } from "react";

/**
 * Responsive modal container.
 * Desktop: centered dialog with max-width.
 * Mobile: full-screen or bottom sheet.
 */
export default function ResponsiveModal({
  children,
  onClose,
  maxWidth = "max-w-lg",
  mode = "center",
}: {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
  mode?: "center" | "sheet";
}) {
  if (mode === "sheet") {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
        <div
          className={`bg-white w-full sm:${maxWidth} sm:rounded-lg rounded-t-xl shadow-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    );
  }

  // center mode: full-screen on mobile, centered on desktop
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className={`bg-white w-full h-full sm:h-auto sm:${maxWidth} sm:rounded-lg sm:shadow-lg sm:max-h-[85vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
