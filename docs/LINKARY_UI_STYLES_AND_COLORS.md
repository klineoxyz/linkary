# Linkary.xyz — CSS, UI styles & colors reference

Single reference for Linkary’s design system. **No code was changed**; this only documents existing styles.

---

## 1. Design system governance (allowed base colors)

From `apps/web/src/figma/styles/theme.css`:

- **#FFFFFF** — white
- **#130600** — dark brown/black (primary dark)
- **#1B0D03** — optional dark variant
- **#FF5300** — Linkary orange (primary brand)

No additional saturated hues. All UI colors derive from CSS variables below.

---

## 2. Light theme (`:root`)

| Variable | Value | Usage |
|----------|--------|--------|
| `--font-size` | `16px` | Base font size |
| `--background` | `#ffffff` | Page / surface |
| `--foreground` | `#130600` | Main text |
| `--card` | `#ffffff` | Cards |
| `--card-foreground` | `#130600` | Text on cards |
| `--popover` | `#ffffff` | Popovers |
| `--popover-foreground` | `#130600` | Popover text |
| `--primary` | `#FF5300` | Buttons, links, brand |
| `--primary-foreground` | `#ffffff` | Text on primary |
| `--secondary` | `rgba(19, 6, 0, 0.06)` | Secondary surfaces |
| `--secondary-foreground` | `#130600` | Text on secondary |
| `--muted` | `rgba(19, 6, 0, 0.04)` | Muted surfaces |
| `--muted-foreground` | `rgba(19, 6, 0, 0.62)` | Muted text |
| `--accent` | `rgba(255, 83, 0, 0.10)` | Accent / hover |
| `--accent-foreground` | `#130600` | Text on accent |
| `--destructive` | `#FF5300` | Destructive actions |
| `--destructive-foreground` | `#ffffff` | Text on destructive |
| `--border` | `rgba(19, 6, 0, 0.12)` | Borders |
| `--input` | `rgba(19, 6, 0, 0.12)` | Input borders |
| `--input-background` | `rgba(19, 6, 0, 0.03)` | Input fill |
| `--switch-background` | `rgba(19, 6, 0, 0.25)` | Switch track |
| `--ring` | `rgba(255, 83, 0, 0.35)` | Focus ring |
| `--radius` | `0.625rem` (10px) | Default border radius |
| `--font-weight-medium` | `500` | |
| `--font-weight-normal` | `400` | |

### Charts

| Variable | Value |
|----------|--------|
| `--chart-1` | `#FF5300` |
| `--chart-2` | `rgba(255, 83, 0, 0.55)` |
| `--chart-3` | `rgba(19, 6, 0, 0.55)` |
| `--chart-4` | `rgba(19, 6, 0, 0.35)` |
| `--chart-5` | `rgba(19, 6, 0, 0.18)` |

### Sidebar (light)

| Variable | Value |
|----------|--------|
| `--sidebar` | `rgba(19, 6, 0, 0.03)` |
| `--sidebar-foreground` | `#130600` |
| `--sidebar-primary` | `#FF5300` |
| `--sidebar-primary-foreground` | `#ffffff` |
| `--sidebar-accent` | `rgba(255, 83, 0, 0.10)` |
| `--sidebar-accent-foreground` | `#130600` |
| `--sidebar-border` | `rgba(19, 6, 0, 0.10)` |
| `--sidebar-ring` | `rgba(255, 83, 0, 0.35)` |

---

## 3. Dark theme (`.dark`)

| Variable | Value |
|----------|--------|
| `--background` | `#130600` |
| `--foreground` | `#ffffff` |
| `--card` | `#130600` |
| `--card-foreground` | `#ffffff` |
| `--popover` | `#130600` |
| `--popover-foreground` | `#ffffff` |
| `--primary` | `#FF5300` |
| `--primary-foreground` | `#ffffff` |
| `--secondary` | `rgba(255, 255, 255, 0.08)` |
| `--secondary-foreground` | `#ffffff` |
| `--muted` | `rgba(255, 255, 255, 0.08)` |
| `--muted-foreground` | `rgba(255, 255, 255, 0.65)` |
| `--accent` | `rgba(255, 255, 255, 0.08)` |
| `--accent-foreground` | `#ffffff` |
| `--destructive` | `#FF5300` |
| `--destructive-foreground` | `#ffffff` |
| `--border` | `rgba(255, 255, 255, 0.12)` |
| `--input` | `rgba(255, 255, 255, 0.12)` |
| `--ring` | `rgba(255, 83, 0, 0.35)` |
| `--sidebar` | `rgba(255, 255, 255, 0.03)` |
| `--sidebar-foreground` | `#ffffff` |
| `--sidebar-primary` | `#FF5300` |
| `--sidebar-primary-foreground` | `#ffffff` |
| `--sidebar-accent` | `rgba(255, 83, 0, 0.15)` |
| `--sidebar-accent-foreground` | `#ffffff` |
| `--sidebar-border` | `rgba(255, 255, 255, 0.10)` |
| `--sidebar-ring` | `rgba(255, 83, 0, 0.35)` |
| `--chart-1` … `--chart-5` | Same primary; chart-3/4/5 use white alpha |

---

## 4. App shell (main app background)

Used for the main app container (e.g. in `App.tsx`):

- **Background:** `#F7F8FB` (light gray)
- **Text:** `text-gray-900` (Tailwind gray-900)
- **Font:** `.font-app` → `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', 'Helvetica Neue', Arial, sans-serif`
- **Smoothing:** `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`
- **Main content:** `text-base antialiased`, padding `p-6 lg:p-10`

So the “Linkary app” look is: **#F7F8FB** background, **gray-900** text, **Inter**-family, with theme variables used for cards, buttons, and borders.

---

## 5. Radius scale (Tailwind theme)

From `theme.css` @theme inline:

- `--radius-sm`: `calc(var(--radius) - 4px)` → 6px
- `--radius-md`: `calc(var(--radius) - 2px)` → 8px
- `--radius-lg`: `var(--radius)` → 10px
- `--radius-xl`: `calc(var(--radius) + 4px)` → 14px

Base `--radius` = `0.625rem` (10px).

---

## 6. Typography (base layer)

- **html:** `font-size: var(--font-size)` (16px)
- **h1:** `text-2xl`, font-weight 500, line-height 1.5
- **h2:** `text-xl`, font-weight 500, line-height 1.5
- **h3:** `text-lg`, font-weight 500, line-height 1.5
- **h4:** `text-base`, font-weight 500, line-height 1.5
- **label:** `text-base`, font-weight 500, line-height 1.5
- **button:** `text-sm`, font-weight 500, line-height 1
- **input:** `text-base`, font-weight 400, line-height 1.5

---

## 7. Custom animations

- **shimmer:** `translateX(-100%)` → `translateX(100%)`, 2s infinite
- **pulse-slow:** opacity 1 ↔ 0.8, 3s cubic-bezier(0.4, 0, 0.6, 1) infinite

Utility classes: `.animate-shimmer`, `.animate-pulse-slow`.

---

## 8. Borders & focus

- **Default border:** `border-border` (uses `--border`)
- **Outline / focus:** `outline-ring/50` (uses `--ring` at 50% opacity)

---

## 9. Quick hex reference

| Name | Hex | Where |
|------|-----|--------|
| White | `#FFFFFF` | Background, cards, primary text on orange |
| Linkary orange | `#FF5300` | Primary, charts, destructive, sidebar primary |
| Dark (foreground) | `#130600` | Text, secondary text |
| Dark variant | `#1B0D03` | Optional dark |
| App shell bg | `#F7F8FB` | Main app container background |
| Gray text (app) | `gray-900` | App shell text (Tailwind) |

---

## 10. Tailwind usage

Use semantic tokens so light/dark stay consistent:

- **Backgrounds:** `bg-background`, `bg-card`, `bg-muted`, `bg-accent`, `bg-primary`
- **Text:** `text-foreground`, `text-muted-foreground`, `text-primary`, `text-primary-foreground`
- **Borders:** `border-border`
- **Radius:** `rounded-lg` (uses `--radius-lg`), etc.
- **Charts:** `chart-1` … `chart-5` for fills/lines

App shell only: `bg-[#F7F8FB] text-gray-900 font-app` for the main wrapper.

---

**Source files (unchanged):**

- `apps/web/src/app/globals.css`
- `apps/web/src/figma/styles/theme.css`
- `apps/web/src/figma/styles/fonts.css`
- `apps/web/src/figma/app/App.tsx` (font-app, bg-[#F7F8FB])
