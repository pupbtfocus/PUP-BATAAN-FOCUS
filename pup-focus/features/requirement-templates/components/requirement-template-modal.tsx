"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
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
  const [maxSizeMb, setMaxSizeMb] = useState<number>(5);
  const [isMandatory, setIsMandatory] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(templateToEdit);

  useEffect(() => {
    if (templateToEdit) {
      setTitle(templateToEdit.title);
      setCode(templateToEdit.code);
      setDescription(templateToEdit.description || "");
      setAllowedFormats(templateToEdit.allowed_formats || ["PDF"]);
      setMaxSizeMb(templateToEdit.max_size_mb || 5);
      setIsMandatory(templateToEdit.is_mandatory);
      setError(null);
    } else {
      setTitle("");
      setCode("");
      setDescription("");
      setAllowedFormats(["PDF", "DOCX"]);
      setMaxSizeMb(5);
      setIsMandatory(true);
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
        if (prev.length === 1) return prev; // Keep at least one
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
      <div className="w-full max-w-xl rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-300 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {isEditing ? "Edit Requirement Template" : "Add Requirement Template"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Configure document compliance rules and validation parameters.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
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
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-800 focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Row 2: Document Slug / Code */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block"
              htmlFor="templateCode"
            >
              Document Slug / Code <span className="text-red-500">*</span>
            </label>
            <input
              id="templateCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isEditing}
              required
              placeholder="e.g. enhanced_syllabus"
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-800 focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all font-mono text-xs disabled:opacity-60"
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
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-800 focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all resize-none"
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
                        ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> : null}
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
                className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 text-sm outline-none transition-all cursor-pointer"
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
                      ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Mandatory
                </button>
                <button
                  type="button"
                  onClick={() => setIsMandatory(false)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    !isMandatory
                      ? "bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Optional
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          {/* Save Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition-all shadow-md mt-2 disabled:opacity-50 cursor-pointer text-sm tracking-wide"
          >
            {isSubmitting ? "Saving Requirement Template..." : "Save Requirement Template"}
          </button>
        </form>
      </div>
    </div>
  );
}
