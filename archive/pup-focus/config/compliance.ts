export const REQUIREMENT_CODE = {
  GRADE_SHEET: "grade_sheet",
  ENHANCED_SYLLABUS: "enhanced_syllabus",
  CLASS_ORIENTATION: "class_orientation",
  MIDTERM_PACKAGE: "midterm_package",
  FINAL_PACKAGE: "final_package",
  CLASS_RECORDS: "class_records",
} as const;

export type RequirementCode =
  (typeof REQUIREMENT_CODE)[keyof typeof REQUIREMENT_CODE];

export const DEFAULT_REQUIREMENTS: RequirementCode[] = [
  REQUIREMENT_CODE.GRADE_SHEET,
  REQUIREMENT_CODE.ENHANCED_SYLLABUS,
  REQUIREMENT_CODE.CLASS_ORIENTATION,
  REQUIREMENT_CODE.MIDTERM_PACKAGE,
  REQUIREMENT_CODE.FINAL_PACKAGE,
  REQUIREMENT_CODE.CLASS_RECORDS,
];

export const REQUIREMENT_LABEL: Record<RequirementCode, string> = {
  [REQUIREMENT_CODE.GRADE_SHEET]: "Grade Sheets",
  [REQUIREMENT_CODE.ENHANCED_SYLLABUS]:
    "Enhanced Course Syllabus (if not yet submitted)",
  [REQUIREMENT_CODE.CLASS_ORIENTATION]:
    "Class Orientation Documentation (photos and narrative report)",
  [REQUIREMENT_CODE.MIDTERM_PACKAGE]:
    "Copy of Midterm Examinations with TOS and Answer Key",
  [REQUIREMENT_CODE.FINAL_PACKAGE]:
    "Copy of Final Examinations with TOS and Answer Key",
  [REQUIREMENT_CODE.CLASS_RECORDS]:
    "Class Records (midterm and final computations)",
};
