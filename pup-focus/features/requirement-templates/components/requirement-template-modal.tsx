"use client";

import { useEffect, useState } from "react";
import { Check, Xmark } from "iconoir-react";
import {
  ALLOWED_FORMAT_OPTIONS,
  MAX_SIZE_OPTIONS,
  type AllowedFormat,
  type RequirementTemplate,
} from "@/features/requirement-templates/types/requirement-template.types";

interface RequirementTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  templateToEdit: RequirementTemplate | null;
}

export function RequirementTemplateModal({
  isOpen,
  onClose,
  onSaved,
  templateToEdit,
}: RequirementTemplateModalProps) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [allowedFormats, setAllowedFormats] = useState<AllowedFormat[]>(["PDF", "DOCX"]);
  const [maxSizeMb, setMaxSizeMb] = useState<number>(10);
  const [isMandatory, setIsMandatory] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(templateToEdit);

  useEffect(() => {
    if (templateToEdit) {
      setTitle(templateToEdit.title);
      setCode(templateToEdit.code);
      setDescription(templateToEdit.description || "");
      setAllowedFormats(templateToEdit.allowed_formats || ["PDF"]);
      setMaxSizeMb(templateToEdit.max_size_mb || 10);
      setIsMandatory(templateToEdit.is_mandatory);
      setIsActive(templateToEdit.is_active);
      setError(null);
    } else {
      setTitle("");
      setCode("");
      setDescription("");
      setAllowedFormats(["PDF", "DOCX"]);
      setMaxSizeMb(10);
      setIsMandatory(true);
      setIsActive(true);
      setError(null);
    }
  }, [templateToEdit, isOpen]);

  if (!isOpen) return null;

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isEditing) {
      const generatedCode = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setCode(generatedCode);
    }
  };

  const toggleFormat = (fmt: AllowedFormat) => {
    setAllowedFormats((prev) => {
      if (prev.includes(fmt)) {
        if (prev.length === 1) return prev; // Keep at least one format
        return prev.filter((f) => f !== fmt);
      }
      return [...prev, fmt];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    if (!cleanTitle) {
      setError("Document name is required.");
      return;
    }

    if (!cleanCode) {
      setError("Document slug / code is required.");
      return;
    }

    if (allowedFormats.length === 0) {
      setError("Please select at least one allowed file format.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && templateToEdit) {
        const res = await fetch("/api/admin/requirement-templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: templateToEdit.id,
            title: cleanTitle,
            description: description.trim() || null,
            allowed_formats: allowedFormats,
            max_size_mb: maxSizeMb,
            is_mandatory: isMandatory,
            is_active: isActive,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to update requirement template.");
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await fetch("/api/admin/requirement-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: cleanTitle,
            code: cleanCode,
            description: description.trim() || null,
            allowed_formats: allowedFormats,
            max_size_mb: maxSizeMb,
            is_mandatory: isMandatory,
            is_active: isActive,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to create requirement template.");
          setIsSubmitting(false);
          return;
        }
      }

      setIsSubmitting(false);
      onSaved();
      onClose();
    } catch {
      setError("Unexpected error while saving requirement template.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-300 dark:border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {isEditing ? "Edit Requirement Template" : "Add Requirement Template"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Configure document compliance parameters, upload limits, and visibility.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition-colors cursor-pointer shadow-2xs"
            aria-label="Close modal"
          >
            <Xmark className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {/* Row 1: Document Name */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block"
              htmlFor="templateTitle"
            >
              Document Name <span className="text-red-500">*</span>
            </label>
            <input
              id="templateTitle"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              placeholder="e.g. Enhanced Course Syllabus"
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm outline-none transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Row 2: Document Slug / Code */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block"
              htmlFor="templateCode"
            >
              Document Identifier Code <span className="text-red-500">*</span>
            </label>
            <input
              id="templateCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isEditing}
              required
              placeholder="e.g. enhanced_syllabus"
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-xs outline-none transition-all font-mono disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Unique identifier used by the compliance engine across submissions.
            </p>
          </div>

          {/* Row 3: Description / Instructions */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block"
              htmlFor="templateDesc"
            >
              Description / Instructions
            </label>
            <textarea
              id="templateDesc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide instructions or submission guidelines for faculty members..."
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm outline-none transition-all resize-none"
            />
          </div>

          {/* Row 4: Allowed File Formats */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              Allowed File Formats <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALLOWED_FORMAT_OPTIONS.map((opt) => {
                const isSelected = allowedFormats.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleFormat(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300 dark:bg-amber-500/20 dark:border-amber-400 shadow-2xs"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" strokeWidth={2} /> : null}
                    <span>{opt.value}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 5: Max File Size & Mandatory Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block"
                htmlFor="templateSize"
              >
                Max File Size <span className="text-red-500">*</span>
              </label>
              <select
                id="templateSize"
                value={maxSizeMb}
                onChange={(e) => setMaxSizeMb(Number(e.target.value))}
                className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 text-xs sm:text-sm outline-none transition-all cursor-pointer"
              >
                {MAX_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Compliance Requirement
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIsMandatory(true)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isMandatory
                      ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300 dark:bg-amber-500/20 dark:border-amber-400 shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Mandatory
                </button>
                <button
                  type="button"
                  onClick={() => setIsMandatory(false)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    !isMandatory
                      ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300 dark:bg-amber-500/20 dark:border-amber-400 shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Optional
                </button>
              </div>
            </div>
          </div>

          {/* Row 6: Visibility Status (Active vs Hidden) */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              Faculty Visibility Status
            </label>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0b5336] text-white border-[#08412a] shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                Active (Visible)
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  !isActive
                    ? "bg-[#780000] text-white border-[#5e0000] shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                Hidden (Archived)
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Hidden templates will not appear in the faculty submission checklist.
            </p>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 px-4 py-3 text-xs sm:text-sm">
              {error}
            </p>
          ) : null}

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-300 dark:border-slate-800 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-semibold px-5 py-2 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
