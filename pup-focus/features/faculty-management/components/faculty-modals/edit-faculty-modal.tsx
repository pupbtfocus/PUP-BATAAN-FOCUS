"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildFacultyInitials, parseFullNameFallback } from "@/lib/faculty-profile";
import type { FacultyAccount } from "@/features/faculty-management/types/faculty-dashboard.types";
import type { ProgramOption } from "@/features/faculty-management/components/faculty-modals/add-faculty-modal";

export interface EditFacultyModalProps {
  facultyId: string;
  facultyAccounts: FacultyAccount[];
  onClose: () => void;
  onSave: () => Promise<void> | void;
}

export function EditFacultyModal({
  facultyId,
  facultyAccounts,
  onClose,
  onSave,
}: EditFacultyModalProps) {
  const selectedFaculty = facultyAccounts.find((f) => f.id === facultyId);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [programId, setProgramId] = useState("");
  const [degreePrograms, setDegreePrograms] = useState<ProgramOption[]>([]);
  const [diplomaCourses, setDiplomaCourses] = useState<ProgramOption[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPrograms() {
      try {
        setIsLoadingPrograms(true);
        const res = await fetch("/api/programs");
        if (res.ok) {
          const data = await res.json();
          const programs = (data.programs ?? []) as ProgramOption[];
          if (isMounted) {
            const degrees: ProgramOption[] = [];
            const diplomas: ProgramOption[] = [];
            programs.forEach((p) => {
              const codeUpper = p.code.toUpperCase();
              const nameUpper = p.name.toUpperCase();
              if (codeUpper.startsWith("D") || nameUpper.includes("DIPLOMA")) {
                diplomas.push(p);
              } else {
                degrees.push(p);
              }
            });
            setDegreePrograms(degrees);
            setDiplomaCourses(diplomas);
          }
        }
      } catch (err) {
        console.error("Failed to load programs in EditFacultyModal:", err);
      } finally {
        if (isMounted) {
          setIsLoadingPrograms(false);
        }
      }
    }

    void loadPrograms();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFaculty) return;

    // Strictly display first_name, middle_name, last_name directly from database fields
    const directFirstName =
      selectedFaculty.first_name ?? selectedFaculty.firstName ?? "";
    const directMiddleName =
      selectedFaculty.middle_name ?? selectedFaculty.middleName ?? "";
    const directLastName =
      selectedFaculty.last_name ?? selectedFaculty.lastName ?? "";

    setFirstName(directFirstName);
    setMiddleName(directMiddleName);
    setLastName(directLastName);

    const targetProgramId = selectedFaculty.program?.id;
    const targetProgramCode = selectedFaculty.program?.code?.toUpperCase();

    const allOptions = [...degreePrograms, ...diplomaCourses];
    const matchedOption = allOptions.find(
      (opt) =>
        (targetProgramId &&
          (opt.id === targetProgramId ||
            opt.id.toLowerCase() === targetProgramId.toLowerCase())) ||
        (targetProgramCode && opt.code.toUpperCase() === targetProgramCode),
    );

    if (matchedOption) {
      setProgramId(matchedOption.id);
    } else if (targetProgramId) {
      setProgramId(targetProgramId);
    } else if (targetProgramCode) {
      setProgramId(targetProgramCode);
    } else {
      setProgramId("");
    }

    setProfileImageFile(null);
    setProfileImagePreviewUrl(selectedFaculty.profileImageUrl);
    setSaveMessage(null);
    setSaveError(null);
  }, [selectedFaculty, degreePrograms, diplomaCourses]);

  useEffect(() => {
    if (!selectedFaculty) return;

    if (!profileImageFile) {
      setProfileImagePreviewUrl(selectedFaculty.profileImageUrl);
      return;
    }

    const previewUrl = URL.createObjectURL(profileImageFile);
    setProfileImagePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [profileImageFile, selectedFaculty]);

  if (!selectedFaculty) {
    return null;
  }

  const createdDate = new Date(selectedFaculty.created_at);
  const formattedDate = createdDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleSaveChanges() {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    if (!selectedFaculty) {
      setSaveError("Faculty not selected.");
      setIsSaving(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("facultyProfileId", selectedFaculty.id);
      formData.append("firstName", firstName);
      formData.append("middleName", middleName);
      formData.append("lastName", lastName);
      formData.append("first_name", firstName);
      formData.append("middle_name", middleName);
      formData.append("last_name", lastName);
      if (programId) {
        formData.append("programId", programId);
        formData.append("program_id", programId);
      }

      if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/admin/faculty/update", {
        method: "PATCH",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error?: unknown }).error)
            : "Failed to save faculty details",
        );
      }

      setSaveMessage("Faculty details updated successfully.");
      await onSave();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save faculty details",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Faculty Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-200"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-4">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-400/30 bg-amber-400/10 text-lg font-semibold text-amber-200">
                    {profileImagePreviewUrl ? (
                      <img
                        src={profileImagePreviewUrl}
                        alt={selectedFaculty.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {buildFacultyInitials(selectedFaculty.fullName)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Profile Picture
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("facultyProfileImageInput")
                          ?.click()
                      }
                      className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 transition hover:bg-slate-700"
                    >
                      Change Photo
                    </button>
                    {profileImageFile ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {profileImageFile.name}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      First Name
                    </p>
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                    />
                  </label>
                  <label className="block">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Middle Name
                    </p>
                    <input
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Last Name
                    </p>
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                    />
                  </label>
                </div>

                <div>
                  <label className="block">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Department / Program
                    </p>
                    <select
                      value={programId}
                      onChange={(e) => setProgramId(e.target.value)}
                      disabled={isLoadingPrograms}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                    >
                      <option value="">-- Select Program / Department --</option>
                      {degreePrograms.length > 0 && (
                        <optgroup label="Degree Programs">
                          {degreePrograms.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} — {p.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {diplomaCourses.length > 0 && (
                        <optgroup label="Diploma Courses">
                          {diplomaCourses.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} — {p.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Email
                  </p>
                  <p className="text-sm text-slate-200">
                    {selectedFaculty.email}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Account Status
                    </p>
                    <p
                      className={`text-sm ${
                        selectedFaculty.is_active
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {selectedFaculty.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Created Date
                    </p>
                    <p className="text-sm text-slate-200">{formattedDate}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 p-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Edit faculty details
                  </p>
                  <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Change the name, department/program, and profile picture for this faculty
                    account.
                  </p>
                </div>

                <div className="space-y-3">
                  {saveMessage ? (
                    <p className="text-sm text-green-300">{saveMessage}</p>
                  ) : null}
                  {saveError ? (
                    <p className="text-sm text-red-400">{saveError}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>

            <input
              id="facultyProfileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                setProfileImageFile(event.target.files?.[0] ?? null);
              }}
            />
          </article>
        </div>
      </div>
    </div>
  );
}
