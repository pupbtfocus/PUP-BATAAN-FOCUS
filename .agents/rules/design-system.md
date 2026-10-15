---
trigger: glob
---

# UI & Design System Guidelines

## Color Consistency & Prohibition of Pitch-Black Badges

1. **Never use pitch-black or near-black fills** (e.g. `bg-slate-950`, `bg-black`, `#020617`, `#000`) for circular badges, status counters, chips, pills, or buttons on gold/amber, light, or accent surfaces.
2. **Badges inside active primary buttons (such as gold/amber buttons)** must use clean white or subtle harmonious tones:
   - Example: `bg-white text-amber-950 shadow-2xs border border-amber-600/30 font-bold`
   - Inactive: `bg-emerald-600 text-white font-bold` or `bg-slate-200 text-slate-700`
3. **Muted and Soft Tokens**:
   - Use soft badges with light backgrounds and dark text (e.g., `bg-amber-50 text-amber-800 border border-amber-200`, `bg-sky-50 text-sky-800 border border-sky-200`, `bg-emerald-50 text-emerald-800 border border-emerald-200`).
   - Avoid oversaturated or dark clashing colors.
