import { describe, it, expect } from "vitest";
import {
  buildFacultyFullName,
  parseFullNameFallback,
} from "../../lib/faculty-profile";
import type { FacultyAccount } from "../../features/faculty-management/types/faculty-dashboard.types";

describe("Faculty Name Parsing & Full Name Helpers", () => {
  it("buildFacultyFullName joins firstName, middleName, and lastName properly", () => {
    const fullName = buildFacultyFullName({
      firstName: "Christian Jay",
      middleName: "Santos",
      lastName: "Cereza",
    });
    expect(fullName).toBe("Christian Jay Santos Cereza");
  });

  it("buildFacultyFullName handles missing middleName gracefully", () => {
    const fullName = buildFacultyFullName({
      firstName: "Christian Jay",
      lastName: "Cereza",
    });
    expect(fullName).toBe("Christian Jay Cereza");
  });

  it("parseFullNameFallback preserves multi-word first names without moving words to middle name", () => {
    const parsed = parseFullNameFallback("Christian Jay Cereza");
    expect(parsed.firstName).toBe("Christian Jay");
    expect(parsed.middleName).toBe("");
    expect(parsed.lastName).toBe("Cereza");
  });

  it("parseFullNameFallback parses 2-word names correctly", () => {
    const parsed = parseFullNameFallback("Juan DelaCruz");
    expect(parsed.firstName).toBe("Juan");
    expect(parsed.middleName).toBe("");
    expect(parsed.lastName).toBe("DelaCruz");
  });

  it("parseFullNameFallback detects explicit middle initials", () => {
    const parsed = parseFullNameFallback("Christian Jay S. Cereza");
    expect(parsed.firstName).toBe("Christian Jay");
    expect(parsed.middleName).toBe("S");
    expect(parsed.lastName).toBe("Cereza");
  });

  it("parseFullNameFallback parses 4-word names properly separating middle and first names", () => {
    const parsed = parseFullNameFallback("Christian Jay Cereza Mandani");
    expect(parsed.firstName).toBe("Christian Jay");
    expect(parsed.middleName).toBe("Cereza");
    expect(parsed.lastName).toBe("Mandani");
  });

  it("parseFullNameFallback handles empty or single word input safely", () => {
    expect(parseFullNameFallback("")).toEqual({
      firstName: "",
      middleName: "",
      lastName: "",
    });
    expect(parseFullNameFallback("Admin")).toEqual({
      firstName: "Admin",
      middleName: "",
      lastName: "",
    });
  });
});

describe("Middle Name Isolation in Faculty Views", () => {
  it("strictly reads middle_name / middleName directly from database object without re-parsing", () => {
    const facultyRecord: FacultyAccount = {
      id: "f-123",
      fullName: "Christian Jay Santos Cereza",
      firstName: "Christian Jay",
      middleName: "Santos",
      lastName: "Cereza",
      first_name: "Christian Jay",
      middle_name: "Santos",
      last_name: "Cereza",
      email: "cjc@pup.edu.ph",
      profileImageUrl: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      program: {
        id: "prog-1",
        code: "BSIT",
        name: "Bachelor of Science in Information Technology",
      },
      requirementStatus: {} as any,
    };

    // Direct extraction matching EditFacultyModal
    const prefillFirstName = facultyRecord.first_name ?? facultyRecord.firstName ?? "";
    const prefillMiddleName = facultyRecord.middle_name ?? facultyRecord.middleName ?? "";
    const prefillLastName = facultyRecord.last_name ?? facultyRecord.lastName ?? "";

    expect(prefillFirstName).toBe("Christian Jay");
    expect(prefillMiddleName).toBe("Santos");
    expect(prefillLastName).toBe("Cereza");
  });

  it("retains empty middle_name when middle name is not set, without pulling from first name", () => {
    const facultyRecordWithoutMiddle: FacultyAccount = {
      id: "f-456",
      fullName: "Christian Jay Cereza",
      firstName: "Christian Jay",
      middleName: "",
      lastName: "Cereza",
      first_name: "Christian Jay",
      middle_name: "",
      last_name: "Cereza",
      email: "cjc@pup.edu.ph",
      profileImageUrl: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      program: null,
      requirementStatus: {} as any,
    };

    const prefillFirstName = facultyRecordWithoutMiddle.first_name ?? facultyRecordWithoutMiddle.firstName ?? "";
    const prefillMiddleName = facultyRecordWithoutMiddle.middle_name ?? facultyRecordWithoutMiddle.middleName ?? "";
    const prefillLastName = facultyRecordWithoutMiddle.last_name ?? facultyRecordWithoutMiddle.lastName ?? "";

    expect(prefillFirstName).toBe("Christian Jay");
    expect(prefillMiddleName).toBe("");
    expect(prefillLastName).toBe("Cereza");
  });
});

describe("Faculty Program Persistence & Filtering Logic", () => {
  const sampleFaculty: FacultyAccount[] = [
    {
      id: "f1",
      fullName: "Christian Jay Cereza",
      email: "cjc@pup.edu.ph",
      profileImageUrl: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      program: {
        id: "prog-1",
        code: "BSIT",
        name: "Bachelor of Science in Information Technology",
      },
      requirementStatus: {} as any,
    },
    {
      id: "f2",
      fullName: "Maria Clara Santos",
      email: "mcs@pup.edu.ph",
      profileImageUrl: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      program: {
        id: "prog-2",
        code: "BSA",
        name: "Bachelor of Science in Accountancy",
      },
      requirementStatus: {} as any,
    },
    {
      id: "f3",
      fullName: "Jose Rizal",
      email: "jrz@pup.edu.ph",
      profileImageUrl: null,
      is_active: false,
      created_at: "2026-01-01T00:00:00Z",
      program: {
        id: "prog-3",
        code: "BEED",
        name: "Bachelor of Elementary Education",
      },
      requirementStatus: {} as any,
    },
  ];

  function filterFaculty(
    facultyList: FacultyAccount[],
    searchTerm: string,
    statusFilter: "all" | "active" | "inactive",
    programFilter: string,
  ) {
    let result = facultyList;

    if (statusFilter === "active") {
      result = result.filter((f) => f.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((f) => !f.is_active);
    }

    if (programFilter && programFilter !== "all") {
      const target = programFilter.toUpperCase();
      result = result.filter(
        (f) =>
          f.program?.code?.toUpperCase() === target ||
          f.program?.id?.toLowerCase() === programFilter.toLowerCase(),
      );
    }

    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter((f) =>
        `${f.fullName} ${f.email}`.toLowerCase().includes(query),
      );
    }

    return result;
  }

  it("filters faculty by specific program code (e.g. BSA, BEED, BSIT)", () => {
    const bsaFaculty = filterFaculty(sampleFaculty, "", "all", "BSA");
    expect(bsaFaculty).toHaveLength(1);
    expect(bsaFaculty[0].fullName).toBe("Maria Clara Santos");

    const beedFaculty = filterFaculty(sampleFaculty, "", "all", "BEED");
    expect(beedFaculty).toHaveLength(1);
    expect(beedFaculty[0].fullName).toBe("Jose Rizal");

    const bsitFaculty = filterFaculty(sampleFaculty, "", "all", "BSIT");
    expect(bsitFaculty).toHaveLength(1);
    expect(bsitFaculty[0].fullName).toBe("Christian Jay Cereza");
  });

  it("returns all faculty when program filter is 'all'", () => {
    const all = filterFaculty(sampleFaculty, "", "all", "all");
    expect(all).toHaveLength(3);
  });

  it("combines status filter and program filter correctly", () => {
    const activeBsa = filterFaculty(sampleFaculty, "", "active", "BSA");
    expect(activeBsa).toHaveLength(1);

    const activeBeed = filterFaculty(sampleFaculty, "", "active", "BEED");
    expect(activeBeed).toHaveLength(0); // Jose Rizal is inactive
  });

  it("accurately matches program dropdown option by ID or Code", () => {
    const programOptions = [
      { id: "prog-1", code: "BSIT", name: "Bachelor of Science in Information Technology" },
      { id: "prog-2", code: "BSA", name: "Bachelor of Science in Accountancy" },
      { id: "prog-3", code: "BSIE", name: "Bachelor of Science in Industrial Engineering" },
    ];

    const faculty = sampleFaculty[0]; // program: { id: "prog-1", code: "BSIT" }
    const matchById = programOptions.find(
      (opt) => opt.id === faculty.program?.id || opt.code.toUpperCase() === faculty.program?.code.toUpperCase(),
    );
    expect(matchById).toBeDefined();
    expect(matchById?.id).toBe("prog-1");
    expect(matchById?.code).toBe("BSIT");
  });
});
