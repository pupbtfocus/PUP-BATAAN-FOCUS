"use client";

export interface ReportColumn {
  header: string;
  key: string;
  align?: "left" | "center" | "right";
}

export interface ReportSummaryStat {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}

export interface GenerateReportOptions {
  title: string;
  subtitle?: string;
  fileName: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
  summaryStats?: ReportSummaryStat[];
}

const SYSTEM_FULL_NAME =
  "PUP FOCUS — Faculty Online Compliance and Uploading System";

function escapeHtml(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStatColors(tone?: ReportSummaryStat["tone"]): {
  bg: string;
  fg: string;
  border: string;
} {
  if (tone === "success") {
    return { bg: "#0b5336", fg: "#ffffff", border: "#08412a" };
  }
  if (tone === "danger") {
    return { bg: "#780000", fg: "#ffffff", border: "#5e0000" };
  }
  if (tone === "warning") {
    return { bg: "#d97706", fg: "#ffffff", border: "#b45309" };
  }
  // Total / default card: solid PUP Gold / Amber
  return { bg: "#f59e0b", fg: "#0f172a", border: "#d97706" };
}

export function exportReportToExcel(options: GenerateReportOptions): void {
  const { title, subtitle, fileName, columns, rows, summaryStats = [] } = options;
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const summaryHtml =
    summaryStats.length > 0
      ? `<tr>
          ${summaryStats
            .map((s) => {
              const colors = getStatColors(s.tone);
              return `<td colspan="${Math.max(
                1,
                Math.floor(columns.length / summaryStats.length)
              )}" style="padding:8px 12px;background:${colors.bg};color:${
                colors.fg
              };font-size:11px;font-weight:bold;border:1px solid ${colors.border};">
                ${escapeHtml(s.label.toUpperCase())}: ${escapeHtml(s.value)}
              </td>`;
            })
            .join("")}
        </tr>`
      : "";

  const headerCells = columns
    .map(
      (col) =>
        `<th style="background:#780000;color:#ffffff;font-weight:bold;padding:8px 12px;border:1px solid #5e0000;text-align:${
          col.align || "left"
        };font-size:11px;">${escapeHtml(col.header)}</th>`
    )
    .join("");

  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="${columns.length}" style="padding:14px;text-align:center;color:#64748b;border:1px solid #cbd5e1;">No records found.</td></tr>`
      : rows
          .map((row, idx) => {
            const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
            const cells = columns
              .map((col) => {
                const rawVal = String(row[col.key] ?? "");
                const lower = rawVal.toLowerCase();
                let cellStyle = `padding:7px 12px;border:1px solid #cbd5e1;text-align:${
                  col.align || "left"
                };font-size:11px;background:${bg};color:#0f172a;`;

                if (
                  lower === "completed" ||
                  lower === "completed / validated" ||
                  lower === "active"
                ) {
                  cellStyle = `padding:7px 12px;border:1px solid #08412a;text-align:${
                    col.align || "left"
                  };font-size:11px;background:#0b5336;color:#ffffff;font-weight:bold;`;
                } else if (
                  lower.includes("not completed") ||
                  lower === "not submitted" ||
                  lower === "inactive" ||
                  lower === "needs revision"
                ) {
                  cellStyle = `padding:7px 12px;border:1px solid #5e0000;text-align:${
                    col.align || "left"
                  };font-size:11px;background:#780000;color:#ffffff;font-weight:bold;`;
                } else if (lower.includes("pending") || lower.includes("in progress")) {
                  cellStyle = `padding:7px 12px;border:1px solid #d97706;text-align:${
                    col.align || "left"
                  };font-size:11px;background:#f59e0b;color:#0f172a;font-weight:bold;`;
                }

                return `<td style="${cellStyle}">${escapeHtml(rawVal)}</td>`;
              })
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");

  const excelContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeHtml(title.slice(0, 28))}</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
</head>
<body style="font-family:Segoe UI,Arial,sans-serif;">
  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td colspan="${columns.length}" style="background:#780000;color:#ffffff;font-size:15px;font-weight:bold;padding:10px 12px;border:1px solid #5e0000;">
        Polytechnic University of the Philippines — Bataan Campus | ${escapeHtml(title)}
      </td>
    </tr>
    <tr>
      <td colspan="${columns.length}" style="background:#4d0000;color:#fcd34d;font-size:11px;font-weight:bold;padding:6px 12px;border:1px solid #5e0000;">
        ${escapeHtml(SYSTEM_FULL_NAME)}
      </td>
    </tr>
    <tr>
      <td colspan="${columns.length}" style="background:#f8fafc;color:#334155;font-size:11px;padding:6px 12px;border:1px solid #cbd5e1;">
        ${subtitle ? `${escapeHtml(subtitle)} • ` : ""}Generated: ${escapeHtml(generatedAt)}
      </td>
    </tr>
    ${summaryHtml}
    <tr>${headerCells}</tr>
    ${bodyRows}
  </table>
</body>
</html>`;

  const blob = new Blob(["\ufeff", excelContent], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, "_");
  link.href = url;
  link.download = `${safeName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportReportToPdf(options: GenerateReportOptions): void {
  const { title, subtitle, columns, rows, summaryStats = [] } = options;
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const logoUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/icons/pup-seal.png`
      : "/icons/pup-seal.png";

  const summaryCardsHtml =
    summaryStats.length > 0
      ? `<div class="summary-grid">
          ${summaryStats
            .map((stat) => {
              const colors = getStatColors(stat.tone);
              return `<div class="stat-card" style="background:${colors.bg};color:${colors.fg};border:1.5px solid ${colors.border};">
                <div class="stat-label">${escapeHtml(stat.label)}</div>
                <div class="stat-value">${escapeHtml(stat.value)}</div>
              </div>`;
            })
            .join("")}
        </div>`
      : "";

  const headerCells = columns
    .map(
      (col) =>
        `<th style="text-align:${col.align || "left"};">${escapeHtml(col.header)}</th>`
    )
    .join("");

  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="${columns.length}" style="text-align:center;padding:20px;color:#64748b;">No records found.</td></tr>`
      : rows
          .map((row) => {
            const cells = columns
              .map((col) => {
                const rawVal = String(row[col.key] ?? "");
                const lower = rawVal.toLowerCase();
                let badgeHtml = escapeHtml(rawVal);

                if (
                  lower === "completed" ||
                  lower === "completed / validated" ||
                  lower === "active"
                ) {
                  badgeHtml = `<span class="badge badge-success">${escapeHtml(rawVal)}</span>`;
                } else if (
                  lower.includes("not completed") ||
                  lower === "not submitted" ||
                  lower === "inactive" ||
                  lower === "needs revision"
                ) {
                  badgeHtml = `<span class="badge badge-danger">${escapeHtml(rawVal)}</span>`;
                } else if (lower.includes("pending") || lower.includes("in progress")) {
                  badgeHtml = `<span class="badge badge-warning">${escapeHtml(rawVal)}</span>`;
                }

                return `<td style="text-align:${col.align || "left"};">${badgeHtml}</td>`;
              })
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} — PUP FOCUS</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
    }
    .header-banner {
      background: #780000;
      color: #ffffff;
      border-bottom: 4px solid #f59e0b;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .pup-logo {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #ffffff;
      padding: 2px;
      border: 2px solid #f59e0b;
      object-fit: contain;
      flex-shrink: 0;
    }
    .brand-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #fcd34d;
      font-weight: 700;
    }
    .system-subtitle {
      font-size: 11.5px;
      color: #fef3c7;
      font-weight: 600;
      margin-top: 1px;
    }
    .system-subtitle b {
      color: #fbbf24;
      font-weight: 900;
    }
    .report-title {
      font-size: 19px;
      font-weight: 800;
      margin: 4px 0 2px;
      color: #ffffff;
    }
    .report-subtitle {
      font-size: 11.5px;
      color: #fde68a;
    }
    .meta-block {
      text-align: right;
      font-size: 11px;
      color: #fef3c7;
      flex-shrink: 0;
    }
    .summary-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-card {
      flex: 1;
      min-width: 130px;
      padding: 10px 14px;
      border-radius: 10px;
    }
    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 800;
      opacity: 0.92;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 900;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    th {
      background: #780000;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      padding: 9px 10px;
      border: 1px solid #5e0000;
    }
    td {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge-success { background: #0b5336; color: #ffffff; }
    .badge-warning { background: #f59e0b; color: #0f172a; }
    .badge-danger { background: #780000; color: #ffffff; }
    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #475569;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-weight: 600;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div class="header-left">
      <img src="${escapeHtml(logoUrl)}" alt="PUP Logo" class="pup-logo" />
      <div>
        <div class="brand-title">Polytechnic University of the Philippines • Bataan Campus</div>
        <div class="system-subtitle"><b>PUP FOCUS</b> — <b>F</b>aculty <b>O</b>nline <b>C</b>ompliance and <b>U</b>ploading <b>S</b>ystem</div>
        <div class="report-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="report-subtitle">${escapeHtml(subtitle)}</div>` : ""}
      </div>
    </div>
    <div class="meta-block">
      <div><strong>PUP FOCUS Official Report</strong></div>
      <div>Generated: ${escapeHtml(generatedAt)}</div>
      <div>Total Records: ${rows.length}</div>
    </div>
  </div>
  ${summaryCardsHtml}
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div class="footer">
    <span>${escapeHtml(SYSTEM_FULL_NAME)}</span>
    <span>Generated on ${escapeHtml(generatedAt)}</span>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=1024,height=768");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
