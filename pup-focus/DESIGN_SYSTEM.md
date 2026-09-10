# PUP FOCUS Design System

Version 1.0 | PUP Bataan Campus - Faculty Online Compliance & Upload System

---

## 1. Design Philosophy

PUP FOCUS is a faculty compliance management system for the Polytechnic University of the Philippines - Bataan Campus. The visual design reflects institutional credibility:

- **Grounded neutrals**: Slate and zinc palettes form the foundation of all internal surfaces.
- **PUP brand identity**: Maroon (#580000) and amber accents are used exclusively on public-facing and authentication screens.
- **Functional clarity**: Every visual element serves a purpose. No decorative gradients, glowing shadows, or ambient effects on dashboard/admin surfaces.
- **Zero emojis**: All interface copy is technical, direct, and concise. No emoji characters in JSX, labels, titles, or documentation.

---

## 2. Color System

### 2.1 Allowed Palette

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
| Border         | `#cbd5e1` / `#d4d4d8`| `border-slate-300` / `border-zinc-300`|
| Text Primary   | `#0f172a`            | `text-slate-900`                      |
| Text Muted     | `#475569`            | `text-slate-600`                      |
| Action Button  | `#0f172a` on light   | `bg-slate-900 text-slate-50 hover:bg-slate-800` |

#### Functional Accents (Status Indicators Only)

| Purpose       | Utility                          |
|---------------|----------------------------------|
| Info/Active   | `bg-blue-600 text-white`         |
| Success       | `bg-emerald-600 text-white`      |
| Warning       | `bg-amber-500 text-slate-950`    |
| Danger        | `bg-rose-600 text-white`         |

### 2.2 Banned Colors

Do not use any of the following in dashboard/admin surfaces:

- `bg-indigo-*`, `bg-purple-*`, `bg-violet-*`, `bg-fuchsia-*`
- `from-purple-*`, `to-cyan-*`, `from-pink-*`
- `shadow-purple-*`, `shadow-cyan-*`
- Any `shadow-[0_0_...]` with colored RGBA values (glow effects)
- Any `bg-gradient-to-*` for decorative purposes on admin surfaces

### 2.3 PUP Brand Colors (Auth/Public Pages Only)

These colors are reserved for login, authentication, and public-facing pages:

| Token        | Value     | Usage                     |
|--------------|-----------|---------------------------|
| PUP Maroon   | `#580000` | Card backgrounds          |
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

### 5.5 Badge

```tsx
{/* Neutral */}
<span className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
  Admin
</span>

{/* Functional (status) */}
<span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
  Active
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

Use `lucide-react` exclusively. Import from `lucide-react`.

### 6.2 Sizing

| Context     | Size Class     | Stroke Width |
|-------------|----------------|--------------|
| Inline/Nav  | `h-4 w-4`     | `1.5`        |
| Panel/Card  | `h-5 w-5`     | `1.5`        |
| Hero/Empty  | `h-8 w-8`     | `1.5`        |

### 6.3 Banned Icons

Never import, render, or reference: `Sparkles`, `Wand2`, `Stars`, `Bot`, or any glowing orb SVGs.

### 6.4 Approved Icon Mapping

| Concept       | Icon              |
|---------------|-------------------|
| Close/Dismiss | `X`               |
| Success       | `Check`           |
| Warning       | `AlertTriangle`   |
| Error         | `XCircle`         |
| Info          | `Info`            |
| Settings      | `Settings`        |
| Search        | `Search`          |
| Filter        | `SlidersHorizontal` |
| Navigate      | `ChevronRight`    |
| Expand        | `ChevronDown`     |
| Lock          | `Lock`            |
| Package       | `Package`         |
| Copy          | `Copy`            |
| Arrow         | `ArrowRight`      |

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
