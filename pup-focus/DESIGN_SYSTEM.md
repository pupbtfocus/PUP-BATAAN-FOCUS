# PUP FOCUS Design System

Version 1.0 | PUP Bataan Campus - Faculty Online Compliance & Upload System

---

## 1. Design Philosophy

PUP FOCUS is a faculty compliance management system for the Polytechnic University of the Philippines - Bataan Campus. The visual design reflects institutional credibility:

- **Grounded neutrals**: Slate and zinc palettes form the foundation of all internal surfaces.
- **PUP brand identity**: Maroon (#580000) and amber accents are used exclusively on public-facing and authentication screens.
- **Functional clarity**: Every visual element serves a purpose. No decorative gradients, glowing shadows, or ambient effects on dashboard/admin surfaces.
- **Zero emojis**: All interface copy is technical, direct, and concise. No emoji characters in JSX, labels, titles, or documentation.

### 1.1 Strict Anti-Duplication Rule (Zero Redundancy Across Entire App)

> [!IMPORTANT]
> **MANDATORY RULE ACROSS THE ENTIRE APP**: Under no circumstances should duplicate action buttons, controls, labels, indicators, or status badges be rendered within the same view, component, modal, or screen. If an action or control already exists, **DO NOT ADD IT AGAIN**.

1. **No Duplicate Buttons or Operational Controls**:
   - Every action (such as `Refresh`, `Download`, `Validate`, `Edit`, `Delete`, `Submit`) must have exactly **ONE** clear, authoritative, and logically placed button per view or screen.
   - Example: If a `Refresh` button is placed in the table actions toolbar, it must NOT also be placed in the modal header or anywhere else in the same view.
   - If an action already exists in any section of a view or container, developers and agents are strictly forbidden from creating a duplicate of it.

2. **No Duplicate Column Headers or Parallel Status Indicators**:
   - Do not create split or parallel columns that communicate the same underlying state (e.g., merge "Status" and "Review Action" into a single consolidated column).
   - A row or card must never show two separate badges stating the same status.

3. **No Duplicate Glyph Stutter on Badges**:
   - Status badges must never render both an icon and a dot together (`● 🕒` or `● ✓`). Badges render either the icon or the dot, never both.

4. **No Redundant Technical Labels or Identifiers**:
   - Do not display database identifier keys (e.g., `grade_sheet`, `enhanced_syllabus`) beneath human-readable titles.
   - Do not display duplicate feedback prompts, helper text, or notes cards.

---

## 2. Color System

### 2.1 Core Status & Action Color Baseline (System Basis)

The PUP FOCUS system color baseline pairs **PUP Institutional Maroon** with a tonal **Dark Green** equal in luminance, visual weight, and contrast. All status indicators, badges, and operational action buttons across tables, dashboards, and modals MUST strictly conform to these tokens:

| Domain / Concept | State / Action | Visual Token & Color | Exact Utility / CSS Tokens |
|---|---|---|---|
| **Account & Template Status** | **Active** | Dark Green (`#0b5336`) | `bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center shadow-2xs` |
| **Account & Template Status** | **Inactive / Archived** | PUP Maroon (`#780000`) | `bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center shadow-2xs` |
| **Academic Term Status** | **Current** | Dark Green (`#0b5336`) | `bg-[#0b5336] text-white border border-[#08412a] px-2.5 py-0.5 text-xs font-semibold rounded-md shadow-2xs` |
| **Academic Term Status** | **Upcoming** | Gold (`#f59e0b`) | `bg-amber-500 text-slate-950 border border-amber-600 px-2.5 py-0.5 text-xs font-semibold rounded-md shadow-2xs` |
| **Document Verification** | **Validate / Validated** | Dark Green (`#0b5336`) | Status Badge: `bg-[#0b5336] text-white border border-[#08412a] px-3 py-1 text-xs font-semibold rounded-md`<br>Action Button: `bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] px-3 py-1.5 text-xs font-semibold rounded-xl shadow-xs` |
| **Document Verification** | **Revision / Needs Revision** | PUP Maroon (`#780000`) | Status Badge: `bg-[#780000] text-white border border-[#5e0000] px-3 py-1 text-xs font-semibold rounded-md`<br>Action Button: `bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3 py-1.5 text-xs font-semibold rounded-xl shadow-xs` |
| **Verification Progress** | **Overall Status: Pending Review** | Gold (`#f59e0b`) | `bg-amber-500 text-slate-950 border border-amber-600 px-2.5 py-0.5 text-xs font-semibold rounded-md shadow-2xs` |
| **Document Verification** | **Pending Review (Per-File)** | Warm Amber | `bg-white text-amber-700 border border-slate-200/90 dark:bg-slate-900 dark:text-amber-400 dark:border-slate-800 px-3 py-1 text-xs font-semibold rounded-md` |
| **Document Verification** | **Not Submitted** | Neutral Slate | `bg-white text-slate-600 border border-slate-200/90 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 px-3 py-1 text-xs font-semibold rounded-md` |
| **Notes & Feedback** | **Remarks** | Dark Green (`#0b5336`) | Label / Icon: `text-[#0b5336] dark:text-emerald-400 font-bold` |
| **Notes & Feedback** | **Revision** | PUP Maroon (`#780000`) | Label / Icon: `text-[#780000] dark:text-rose-400 font-bold` |
| **Toggle Switches & Checkboxes** | **Active / Checked (On)** | PUP Gold (`#f59e0b`) | Track: `bg-amber-500 border border-amber-400 shadow-xs focus:ring-amber-500/50`<br>Knob: `translate-x-5.5 bg-slate-950`<br>Checkbox: `bg-amber-500 border-amber-400` |

### 2.2 Operational Action Buttons & Controls Color Palette

Buttons and controls across administrative management, faculty settings, and verification panels are standardized into functional color roles:

#### 1. Gold / Amber Primary, Constructive Actions & Active Toggles
**Utility**: `bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shadow-xs transition-colors cursor-pointer border border-amber-600`  
Used exclusively for administrative creations, additions, non-destructive configurations, schedule edits, downloads, account activations, and active toggle/selection states:
- **Add Faculty**
- **+ Create Next Academic Year** (Panel & Modal)
- **Download All (ZIP)** (Verification & Submission Panels)
- **Edit / Edit Profile**
- **Activate**
- **Extend Window**
- **Edit Schedule**
- **Save Profile Changes**
- **Update Password**
- **Save System Preferences**
- **Toggle Switches (Active / On)**: `bg-amber-500 border border-amber-400 shadow-xs` track with `translate-x-5.5 bg-slate-950` knob
- **Multi-Select & Format Toggles (Active / Selected)**: `bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300 dark:bg-amber-500/20 dark:border-amber-400 shadow-2xs`

#### 2. Dark Green Verification & Activation Actions
**Utility**: `bg-[#0b5336] hover:bg-[#073d2a] text-white font-semibold border border-[#08412a] shadow-xs transition-colors cursor-pointer`  
Used exclusively for document validation, approvals, and setting active/current academic term:
- **Validate** (Table Row Action)
- **Validate All Pending** (Verification Toolbar Action)
- **Confirm & Validate** (Single Requirement Modal)
- **Confirm & Validate All** (Bulk Modal)
- **Set Current** (Academic Term Management Row & Modal Switch)

#### 3. PUP Maroon Destructive, Dismissive & Cancel Actions
**Solid Utility**: `bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] shadow-xs transition-colors cursor-pointer`  
**Dismiss X Utility**: `rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition-colors cursor-pointer shadow-2xs`  
Used for all destructive, revoking, deactivating, closing, deleting, revision requests, and ALL modal dismissals and cancellations:
- **Cancel** (All modals, dialogs, drawers, safety timers, and form cards are solid maroon)
- **Close** (Modal footers and detailed view dialogs)
- **Close 'X' / Dismiss** (Top-right modal headers, lightbox previewers, drawer dismissals)
- **Deactivate**
- **Delete** (Faculty Accounts, Academic Terms, Admin Accounts)
- **Close Submissions** / **Confirm Close Submissions**
- **Revision** (Table Row Action)
- **Send Revision Request** (Revision Modal)

### 2.3 Surface & Border Palette

#### Dark Mode

| Token          | Value                | Tailwind Utility                      |
|----------------|----------------------|---------------------------------------|
| Base           | `#020617` / `#09090b`| `bg-slate-950` / `bg-zinc-950`        |
| Surface        | `#0f172a` / `#18181b`| `bg-slate-900` / `bg-zinc-900`        |
| Border         | `#1e293b` / `#27272a`| `border-slate-800` / `border-zinc-800`|
| Text Primary   | `#f1f5f9`            | `text-slate-100`                      |
| Text Muted     | `#94a3b8`            | `text-slate-400`                      |
| Action Button  | `#f1f5f9` on dark    | `bg-slate-100 text-slate-900 hover:bg-slate-200` |

#### Light Mode

| Token          | Value                | Tailwind Utility                      |
|----------------|----------------------|---------------------------------------|
| Base           | `#f8fafc` / `#fafafa`| `bg-slate-50` / `bg-zinc-50`          |
| Surface        | `#ffffff` / `#f4f4f5`| `bg-white` / `bg-zinc-100`            |
| Border         | `#cbd5e1` / `#94a3b8`| `border-slate-300` / `border-slate-200/90` |
| Text Primary   | `#0f172a`            | `text-slate-900`                      |
| Text Muted     | `#475569`            | `text-slate-600`                      |
| Action Button  | `#0f172a` on light   | `bg-slate-900 text-slate-50 hover:bg-slate-800` |

#### Sidebar Navigation & Active States

- **Sidebar Container**: `bg-white text-slate-900 border-r border-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800`
- **Active Sidebar Item**: `bg-slate-100 text-slate-900 font-semibold border-l-2 border-slate-900 dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-100 transition-colors`
- **Inactive Sidebar Item**: `text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200 transition-colors`

#### Cards, Panels & Modal Surfaces

- **Main Card Container**: `bg-white text-slate-900 border border-slate-300 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800`
- **Inner Sections & Sub-panels**: `bg-slate-50 border border-slate-300/80 dark:bg-slate-900/50 dark:border-slate-800`
- **Primary Headlines & Values**: `text-slate-900 dark:text-slate-100 font-semibold`
- **Sub-labels & Form Field Titles**: `text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider`

#### Table Action Buttons & Filter Controls

- **Secondary / Neutral Table Action Buttons ("View Details")**: `bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-xs font-medium rounded-md px-2.5 py-1 transition-colors`
- **Search & Dropdown Inputs**: `bg-white text-slate-900 border border-slate-300 focus:border-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-slate-600`
- **Active Filter Tab ("All")**: `bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium`
- **Inactive Filter Tabs**: `text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60`

### 2.4 Banned Colors

Do not use any of the following in dashboard/admin surfaces:

- `bg-indigo-*`, `bg-purple-*`, `bg-violet-*`, `bg-fuchsia-*`
- `from-purple-*`, `to-cyan-*`, `from-pink-*`
- `shadow-purple-*`, `shadow-cyan-*`
- Any `shadow-[0_0_...]` with colored RGBA values (glow effects)
- Any `bg-gradient-to-*` for decorative purposes on admin surfaces

### 2.5 PUP Brand Colors (Auth/Public Pages Only)

These colors are reserved for login, authentication, and public-facing pages:

| Token        | Value     | Usage                     |
|--------------|-----------|---------------------------|
| PUP Maroon   | `#580000` / `#780000` | Card backgrounds, brand accents |
| PUP Dark     | `#2d0000` | Gradient endpoints        |
| PUP Amber    | `#f59e0b` | Accent borders, buttons   |

---

## 3. Typography

### 3.1 Font Stack

| Role         | Font Family       | CSS Variable             |
|--------------|-------------------|--------------------------|
| Interface    | Geist Sans        | `var(--font-geist-sans)` |
| Data/Metrics | Geist Mono        | `var(--font-geist-mono)` |

### 3.2 Scale

| Element            | Class                                          |
|--------------------|-------------------------------------------------|
| Page Title         | `text-xl font-bold tracking-wide`               |
| Section Heading    | `text-base font-semibold`                       |
| Body Text          | `text-sm`                                       |
| Small/Caption      | `text-xs`                                       |
| Metric Value       | `text-2xl font-bold font-mono`                  |
| Badge Label        | `text-[10px] uppercase tracking-[0.12em] font-semibold` |

---

## 4. Spacing and Radius

| Token           | Value       | Usage                          |
|-----------------|-------------|--------------------------------|
| Default Radius  | `0.375rem`  | `rounded-md` -- buttons, inputs|
| Card Radius     | `0.75rem`   | `rounded-xl` -- cards, panels  |
| Pill Radius     | `9999px`    | `rounded-full` -- badges, tags |
| Border Width    | `1px`       | `border` -- clean single lines |

---

## 5. Component Blueprints

### 5.1 Card

```tsx
<div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
    Card Title
  </h3>
  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
    Card description text.
  </p>
</div>
```

### 5.2 Button (Primary)

```tsx
<button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors">
  Submit
</button>
```

### 5.3 Button (Destructive)

```tsx
<button className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors">
  Delete
</button>
```

### 5.4 Input

```tsx
<input
  type="text"
  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
  placeholder="Enter value"
/>
```

### 5.5 Badges and Chips

```tsx
{/* Neutral / Draft */}
{/* Active Status / Validate / Validated */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-[#0b5336] text-white border border-[#08412a] shadow-2xs">
  <CheckCircle className="h-3.5 w-3.5 text-white" />
  Active
</span>

{/* Inactive Status / Revision / Needs Revision */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
  <WarningCircle className="h-3.5 w-3.5 text-white" />
  Inactive
</span>

{/* Pending Review */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-white text-amber-700 border border-slate-200/90 dark:bg-slate-900 dark:text-amber-400 dark:border-slate-800">
  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
  Pending Review
</span>

{/* Not Submitted */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-white text-slate-600 border border-slate-200/90 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
  Not Submitted
</span>
```

### 5.6 Modal Overlay

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
  <div className="w-full max-w-md rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
    {/* Modal content */}
  </div>
</div>
```

### 5.7 Navigation Item (Sidebar)

```tsx
{/* Active */}
<button className="flex w-full items-center gap-2.5 rounded-full bg-amber-500/15 px-4 py-2.5 text-xs font-semibold text-amber-950 dark:bg-amber-500/20 dark:text-amber-300">
  <LayoutDashboard size={16} className="text-amber-700 dark:text-amber-300" />
  Dashboard
</button>

{/* Inactive */}
<button className="flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100">
  <Settings size={16} className="text-slate-500 dark:text-slate-400" />
  Settings
</button>
```

---

## 6. Iconography

### 6.1 Library

Use `iconoir-react` exclusively. Import directly from `'iconoir-react'`:

```tsx
import { Settings, Search, NavArrowRight, Xmark, Check, InfoCircle, WarningTriangle } from 'iconoir-react';
```

### 6.2 Sizing and Stroke Width

Standardize all icons to `h-4 w-4` (inline/nav) or `h-5 w-5` (panel/modal header) with bold stroke width `strokeWidth={2}`:

| Context     | Size Class     | Stroke Width | Component Usage Example |
|-------------|----------------|--------------|-------------------------|
| Inline/Nav  | `h-4 w-4`      | `2`          | `<Search className="h-4 w-4" strokeWidth={2} />` |
| Panel/Card  | `h-5 w-5`      | `2`          | `<Settings className="h-5 w-5" strokeWidth={2} />` |
| Hero/Empty  | `h-8 w-8`      | `2`          | `<Page className="h-8 w-8" strokeWidth={2} />` |

### 6.3 Banned Icons

Never import, render, or reference: `Sparkles`, `Wand2`, `Stars`, `Bot`, or any glowing orb SVGs.

### 6.4 Approved Icon Mapping (Iconoir)

| Concept       | Iconoir Component   | Usage                                 |
|---------------|---------------------|---------------------------------------|
| Close/Dismiss | `Xmark`             | Modal / drawer close buttons          |
| Success/Done  | `Check`             | Completed items, confirmations        |
| Validated     | `CheckCircle`       | Document validated status             |
| Warning       | `WarningTriangle`   | Destructive actions, schedule alerts  |
| Alert/Notice  | `WarningCircle`     | Form error alerts                     |
| Error         | `XmarkCircle`       | Rejected or failed items              |
| Info          | `InfoCircle`        | Information tooltips and notices      |
| Settings      | `Settings`          | Settings panels and preferences       |
| Search        | `Search`            | Search filters and input bars         |
| Filter        | `Filter`            | Table and list filtering              |
| Navigate/Next | `NavArrowRight`     | List row chevron, breadcrumb          |
| Expand        | `NavArrowDown`      | Dropdown and accordions               |
| Collapse      | `NavArrowUp`        | Collapsible panels                    |
| Back          | `NavArrowLeft`      | Back navigation                       |
| Lock/Secure   | `Lock`              | Password, closed submission window    |
| Unlock        | `LockSlash`         | Opened or extended permission         |
| Package/Batch | `Package`           | Batch actions                         |
| Copy          | `Copy`              | Clipboard copy action                 |
| Arrow         | `ArrowRight`        | Action buttons, CTA links             |
| Refresh       | `Refresh`           | Data refresh buttons                  |
| Spinner       | `SystemRestart`     | Animated loading state                |
| Users/Group   | `Group`             | Faculty lists, user management        |
| User Item     | `User`              | Profile avatar, individual admin      |
| Add User      | `UserPlus`          | Create faculty/admin account          |
| Remove User   | `UserXmark`         | Deactivate faculty account            |
| Verified User | `UserBadgeCheck`    | Active verified user status           |
| Document/File | `Page`              | Generic file or text requirement      |
| Spreadsheet   | `Reports`           | Excel / tabular compliance file       |
| Archive/Zip   | `Archive`           | Compressed backup / archive bundle    |
| Code File     | `Code`              | Source code attachment                |
| Image File    | `MediaImage`        | Image requirement                     |
| Download      | `Download`          | File download action                  |
| Upload        | `Upload`            | Document submission upload zone       |
| Cloud Upload  | `CloudUpload`       | Remote sync/backup                    |
| Edit          | `EditPencil`        | Rename, update requirement template   |
| Delete/Trash  | `Trash`             | Delete account or record              |
| Save/Floppy   | `FloppyDisk`        | Form save buttons                     |
| History       | `ClockRotateRight`  | Submission history, audit logs        |
| Clock/Timer   | `Clock`             | Deadline, submission window timer     |

---

## 7. Interaction States

### 7.1 Hover

Use `transition-colors` with flat color shifts. No glow, no ambient shadow on hover.

```
hover:bg-slate-200    (light mode surface)
dark:hover:bg-slate-800  (dark mode surface)
```

### 7.2 Focus

```
focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600
```

### 7.3 Active/Pressed

```
active:scale-[0.98]   (subtle press feedback)
```

### 7.4 Disabled

```
disabled:opacity-50 disabled:cursor-not-allowed
```

---

## 8. Shadows

| Level   | Utility      | Usage                     |
|---------|--------------|---------------------------|
| Minimal | `shadow-xs`  | Subtle cards              |
| Default | `shadow-sm`  | Elevated cards, dropdowns |
| Medium  | `shadow-md`  | Modals                    |
| High    | `shadow-xl`  | Overlays, popovers        |

All shadows must be **neutral** (default Tailwind shadow color). Never use colored shadows (`shadow-purple-*`, `shadow-cyan-*`, etc.) on admin surfaces.
