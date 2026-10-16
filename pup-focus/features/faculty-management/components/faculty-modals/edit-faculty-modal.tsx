"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, EditPencil, User, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { AlertPopup } from "@/components/ui/alert-popup";
import { Button } from "@/components/ui/button";
import { buildFacultyInitials, parseFullNameFallback } from "@/lib/faculty-profile";
import type { FacultyAccount } from "@/features/faculty-management/types/faculty-dashboard.types";
import type { ProgramOption } from "@/features/faculty-management/components/faculty-modals/add-faculty-modal";

export interface EditFacultyModalProps {
  facultyId: string;
  facultyAccounts: FacultyAccount[];
  onClose: () => void;
  onSave?: (updatedFaculty?: Partial<FacultyAccount>) => Promise<void> | void;
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const middleNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);

  const [activeField, setActiveField] = useState<
    "firstName" | "middleName" | "lastName" | null
  >(null);

  const [initialValues, setInitialValues] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    programId: "",
  });

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

    let resolvedProgramId = "";
    if (matchedOption) {
      resolvedProgramId = matchedOption.id;
    } else if (targetProgramId) {
      resolvedProgramId = targetProgramId;
    } else if (targetProgramCode) {
      resolvedProgramId = targetProgramCode;
    } else {
      resolvedProgramId = "";
    }
    setProgramId(resolvedProgramId);

    setInitialValues({
      firstName: directFirstName,
      middleName: directMiddleName,
      lastName: directLastName,
      programId: resolvedProgramId,
    });
    setActiveField(null);

    setProfileImageFile(null);
    setProfileImagePreviewUrl(selectedFaculty.profileImageUrl);
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

  function handleFocusField(
    fieldKey: "firstName" | "middleName" | "lastName",
    ref: React.RefObject<HTMLInputElement | null>,
  ) {
    setActiveField(fieldKey);
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        const length = ref.current.value.length;
        ref.current.setSelectionRange(length, length);
      }
    }, 0);
  }

  function handleCancelEdit(fieldKey: "firstName" | "middleName" | "lastName") {
    if (fieldKey === "firstName") setFirstName(initialValues.firstName);
    if (fieldKey === "middleName") setMiddleName(initialValues.middleName);
    if (fieldKey === "lastName") setLastName(initialValues.lastName);
    setActiveField(null);
  }

  if (!selectedFaculty) {
    return null;
  }

  const createdDate = new Date(selectedFaculty.created_at);
  const formattedDate = createdDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hasChanges =
    firstName.trim() !== initialValues.firstName.trim() ||
    middleName.trim() !== initialValues.middleName.trim() ||
    lastName.trim() !== initialValues.lastName.trim() ||
    programId !== initialValues.programId ||
    Boolean(profileImageFile);

  const isNameValid = firstName.trim().length > 0 && lastName.trim().length > 0;

  const currentFullName = [firstName.trim(), middleName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");

  const selectedProgramObj = [...degreePrograms, ...diplomaCourses].find(
    (p) => p.id === programId,
  );

  async function handleConfirmSave() {
    setIsSaving(true);
    setSaveError(null);

    if (!selectedFaculty) {
      setSaveError("Faculty not selected.");
      setIsSaving(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("facultyProfileId", selectedFaculty.id);
      formData.append("firstName", firstName.trim());
      formData.append("middleName", middleName.trim());
      formData.append("lastName", lastName.trim());
      formData.append("first_name", firstName.trim());
      formData.append("middle_name", middleName.trim());
      formData.append("last_name", lastName.trim());
      if (programId) {
        formData.append("programId", programId);
        formData.append("program_id", programId);
      }

      if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/staff/faculty/update", {
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

      const updatedProgram = selectedProgramObj
        ? {
            id: selectedProgramObj.id,
            code: selectedProgramObj.code,
            name: selectedProgramObj.name,
          }
        : selectedFaculty.program;

      const updatedFacultyData: Partial<FacultyAccount> = {
        id: selectedFaculty.id,
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        fullName: currentFullName,
        profileImageUrl: profileImagePreviewUrl,
        program: updatedProgram,
      };

      setInitialValues({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        programId,
      });
      setProfileImageFile(null);
      setActiveField(null);
      setShowConfirmModal(false);
      setShowSuccessModal(true);

      if (onSave) {
        await onSave(updatedFacultyData);
      }
    } catch (error) {
      setShowConfirmModal(false);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save faculty details",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCloseSuccess() {
    setShowSuccessModal(false);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6 shadow-2xl flex flex-col">
          <ModalHeader
            icon={User}
            title="Faculty Details"
            subtitle="View and manage faculty profile and department assignments"
            className="-mx-6 -mt-6 mb-5 rounded-t-2xl"
            onClose={onClose}
          />

          <div className="space-y-5 flex-1">
            {saveError ? (
              <AlertPopup
                type="error"
                message={saveError}
                position="inline"
                onClose={() => setSaveError(null)}
              />
            ) : null}

            <article className="rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-18 w-18 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/30 bg-slate-100 dark:bg-slate-800 text-lg font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                  {profileImagePreviewUrl ? (
                    <img
                      src={profileImagePreviewUrl}
                      alt={selectedFaculty.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{buildFacultyInitials(selectedFaculty.fullName)}</span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                    Profile Picture
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("facultyProfileImageInput")
                          ?.click()
                      }
                      className="rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs"
                    >
                      Change Photo
                    </button>
                    {profileImageFile ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-600 dark:text-amber-400 truncate max-w-[140px] font-medium">
                          {profileImageFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileImageFile(null);
                            const input = document.getElementById(
                              "facultyProfileImageInput",
                            ) as HTMLInputElement | null;
                            if (input) input.value = "";
                          }}
                          className="text-xs text-rose-500 hover:text-rose-600 hover:underline cursor-pointer font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <div className="space-y-1.5">
                  <label
                    htmlFor="faculty-first-name"
                    className="block text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold"
                  >
                    First Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="faculty-first-name"
                      ref={firstNameInputRef}
                      readOnly={activeField !== "firstName"}
                      className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3.5 pr-9 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                        activeField === "firstName"
                          ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                      }`}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      onBlur={() => setActiveField(null)}
                      placeholder="First name"
                    />
                    {activeField === "firstName" ? (
                      <button
                        type="button"
                        title="Cancel edit"
                        aria-label="Cancel edit"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleCancelEdit("firstName")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={Xmark} size="xs" color="inherit" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Edit first name"
                        aria-label="Edit first name"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handleFocusField("firstName", firstNameInputRef)
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={EditPencil} size="xs" color="inherit" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="faculty-middle-name"
                    className="block text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold"
                  >
                    Middle Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="faculty-middle-name"
                      ref={middleNameInputRef}
                      readOnly={activeField !== "middleName"}
                      className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3.5 pr-9 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                        activeField === "middleName"
                          ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                      }`}
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                      onBlur={() => setActiveField(null)}
                      placeholder="Middle name"
                    />
                    {activeField === "middleName" ? (
                      <button
                        type="button"
                        title="Cancel edit"
                        aria-label="Cancel edit"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleCancelEdit("middleName")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={Xmark} size="xs" color="inherit" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Edit middle name"
                        aria-label="Edit middle name"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handleFocusField("middleName", middleNameInputRef)
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={EditPencil} size="xs" color="inherit" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label
                    htmlFor="faculty-last-name"
                    className="block text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold"
                  >
                    Last Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="faculty-last-name"
                      ref={lastNameInputRef}
                      readOnly={activeField !== "lastName"}
                      className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3.5 pr-9 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                        activeField === "lastName"
                          ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                      }`}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      onBlur={() => setActiveField(null)}
                      placeholder="Last name"
                    />
                    {activeField === "lastName" ? (
                      <button
                        type="button"
                        title="Cancel edit"
                        aria-label="Cancel edit"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleCancelEdit("lastName")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={Xmark} size="xs" color="inherit" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Edit last name"
                        aria-label="Edit last name"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handleFocusField("lastName", lastNameInputRef)
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={EditPencil} size="xs" color="inherit" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <label
                  htmlFor="faculty-department-program"
                  className="block text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold"
                >
                  Department / Program
                </label>
                <select
                  id="faculty-department-program"
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  disabled={isLoadingPrograms}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/80 dark:focus:ring-amber-500/60 transition-all cursor-pointer"
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
              </div>

              <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                    Email
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={selectedFaculty.email}>
                    {selectedFaculty.email}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                    Account Status
                  </p>
                  <p
                    className={`text-xs font-semibold inline-flex items-center px-2 py-0.5 rounded-md border shadow-2xs ${
                      selectedFaculty.is_active
                        ? "bg-[#0b5336] text-white border-[#08412a]"
                        : "bg-[#780000] text-white border-[#5e0000]"
                    }`}
                  >
                    {selectedFaculty.is_active ? "Active" : "Inactive"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                    Created Date
                  </p>
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-200">
                    {formattedDate}
                  </p>
                </div>
              </div>
            </article>

            <input
              id="facultyProfileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                setProfileImageFile(event.target.files?.[0] ?? null);
              }}
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="maroon"
              onClick={onClose}
              className="cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSaving || !hasChanges || !isNameValid}
              className="disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
            <ModalHeader
              icon={EditPencil}
              title="Save Changes?"
              subtitle="Confirm Faculty Profile Update"
              onClose={isSaving ? undefined : () => setShowConfirmModal(false)}
              closeDisabled={isSaving}
              className="-mx-6 -mt-6 mb-5 rounded-t-2xl"
            />

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/40 bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {profileImagePreviewUrl ? (
                      <img
                        src={profileImagePreviewUrl}
                        alt={currentFullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{buildFacultyInitials(currentFullName)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {currentFullName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {selectedProgramObj
                        ? `${selectedProgramObj.code} — ${selectedProgramObj.name}`
                        : "No department assigned"}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold mb-1 text-slate-700 dark:text-slate-200">
                    Pending modifications:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
                    {firstName.trim() !== initialValues.firstName.trim() ||
                    middleName.trim() !== initialValues.middleName.trim() ||
                    lastName.trim() !== initialValues.lastName.trim() ? (
                      <li>Updated faculty name</li>
                    ) : null}
                    {programId !== initialValues.programId ? (
                      <li>Changed department / program assignment</li>
                    ) : null}
                    {profileImageFile ? <li>New profile photo selected</li> : null}
                  </ul>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Are you sure you want to save these changes to this faculty account?
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="maroon"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSaving}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Confirm & Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Success Modal */}
      {showSuccessModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
            <ModalHeader
              icon={CheckCircle}
              title="Changes Saved"
              subtitle="Faculty Profile Updated"
              onClose={handleCloseSuccess}
              className="-mx-6 -mt-6 mb-5 rounded-t-2xl"
            />

            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <AppIcon
                  icon={CheckCircle}
                  size="md"
                  className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <p className="font-semibold text-sm">Update Successful</p>
                  <p>
                    Faculty details for{" "}
                    <strong className="font-bold">{currentFullName}</strong> have been
                    successfully updated.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <Button
                  type="button"
                  variant="maroon"
                  onClick={handleCloseSuccess}
                  className="cursor-pointer px-6"
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
