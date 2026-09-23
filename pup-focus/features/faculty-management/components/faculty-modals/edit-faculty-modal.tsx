"use client";

import { useEffect, useRef, useState } from "react";
import { EditPencil, User, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
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

      setInitialValues({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        programId,
      });
      setProfileImageFile(null);
      setActiveField(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6 shadow-xl">
        <ModalHeader
          icon={User}
          title="Faculty Details"
          subtitle="View and manage faculty profile and department assignments"
          className="-mx-6 -mt-6 mb-5 rounded-t-xl"
        />

        <div className="space-y-4">
          <article className="rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 p-4">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-lg font-semibold text-slate-700 dark:text-slate-300">
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
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                      Profile Picture
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("facultyProfileImageInput")
                          ?.click()
                      }
                      className="rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium transition cursor-pointer"
                    >
                      Change Photo
                    </button>
                    {profileImageFile ? (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-amber-600 dark:text-amber-400 truncate max-w-[140px]">
                          {profileImageFile.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileImageFile(null);
                            const input = document.getElementById(
                              "facultyProfileImageInput",
                            ) as HTMLInputElement | null;
                            if (input) input.value = "";
                          }}
                          className="text-xs text-rose-500 hover:text-rose-600 hover:underline cursor-pointer font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                          onClick={() => handleFocusField("firstName", firstNameInputRef)}
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
                          onClick={() => handleFocusField("middleName", middleNameInputRef)}
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
                          onClick={() => handleFocusField("lastName", lastNameInputRef)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                        >
                          <AppIcon icon={EditPencil} size="xs" color="inherit" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
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
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/80 dark:focus:ring-amber-500/60 transition-all cursor-pointer"
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

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                    Email
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {selectedFaculty.email}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                      Account Status
                    </p>
                    <p
                      className={`text-xs font-semibold inline-flex items-center px-2 py-0.5 rounded-md border shadow-2xs mt-1 ${
                        selectedFaculty.is_active
                          ? "bg-[#0b5336] text-white border-[#08412a]"
                          : "bg-[#780000] text-white border-[#5e0000]"
                      }`}
                    >
                      {selectedFaculty.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
                      Created Date
                    </p>
                    <p className="text-sm text-slate-900 dark:text-slate-200">{formattedDate}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 p-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Edit faculty details
                  </p>
                  <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Change the name, department/program, and profile picture for this faculty
                    account.
                  </p>
                </div>

                <div className="space-y-3">
                  {saveMessage ? (
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">{saveMessage}</p>
                  ) : null}
                  {saveError ? (
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">{saveError}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={isSaving || !hasChanges || !isNameValid}
                    className="disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="maroon"
                    onClick={onClose}
                    className="cursor-pointer"
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
