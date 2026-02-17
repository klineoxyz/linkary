# 🎨 Linkary Design Token System

**Infrastructure-Grade Design System**  
**Version 2.0 - Professional Contrast Standards**

---

## 🎯 Design Philosophy

### Core Principles:
✅ **Sharp > Soft**  
✅ **Contrast > Glow**  
✅ **Clarity > Trendy**  
✅ **Data-first > Decoration**  
✅ **Professional > Aesthetic**

### Reference:
- **Do**: Stripe, Linear, Vercel, Notion
- **Don't**: Dribbble gradients, Web3 concept art, soft pastels

---

## 🎨 COLOR SYSTEM

### Light Mode (Default)

#### Backgrounds
```css
--bg-primary: #FFFFFF        /* Main content background */
--bg-secondary: #F8FAFC      /* Section backgrounds */
--bg-tertiary: #F1F5F9       /* Subtle emphasis */
--bg-elevated: #FFFFFF       /* Cards, modals */
```

#### Text
```css
--text-primary: #0F172A      /* Headings, key content - slate-900 */
--text-secondary: #334155    /* Body text - slate-700 */
--text-muted: #64748B        /* Labels, captions - slate-600 */
--text-subtle: #94A3B8       /* Hints, disabled - slate-500 */
```

#### Borders
```css
--border-primary: #E2E8F0    /* Standard borders - slate-200 */
--border-secondary: #CBD5E1  /* Emphasized borders - slate-300 */
--border-subtle: #F1F5F9     /* Dividers - slate-100 */
```

---

### Dark Mode (Sidebar, Dark Sections)

#### Backgrounds
```css
--dark-bg-primary: #0D0F1A    /* Primary dark background */
--dark-bg-secondary: #141826  /* Slightly lighter */
--dark-bg-tertiary: #1E2333   /* Cards on dark */
--dark-bg-elevated: #252B3D   /* Elevated cards */
```

#### Text
```css
--dark-text-primary: #FFFFFF       /* White - 100% */
--dark-text-secondary: #FFFFFF/70  /* White 70% opacity */
--dark-text-muted: #FFFFFF/60      /* White 60% opacity */
--dark-text-subtle: #FFFFFF/50     /* White 50% opacity */
```

#### Borders
```css
--dark-border-primary: #FFFFFF/10  /* Standard borders */
--dark-border-secondary: #FFFFFF/20 /* Emphasized borders */
--dark-border-subtle: #FFFFFF/5    /* Subtle dividers */
```

---

## 📊 TYPOGRAPHY SCALE

### Font Family
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Font Sizes
```css
--text-xs: 0.75rem      /* 12px - Captions, timestamps */
--text-sm: 0.875rem     /* 14px - Small body, labels */
--text-base: 1rem       /* 16px - Body text */
--text-lg: 1.125rem     /* 18px - Emphasized body */
--text-xl: 1.25rem      /* 20px - Subheadings */
--text-2xl: 1.5rem      /* 24px - Section titles */
--text-3xl: 1.875rem    /* 30px - Page titles */
--text-4xl: 2.25rem     /* 36px - Hero metrics */
--text-5xl: 3rem        /* 48px - Display text */
```

### Font Weights
```css
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Line Heights
```css
--leading-none: 1
--leading-tight: 1.25
--leading-snug: 1.375
--leading-normal: 1.5
--leading-relaxed: 1.625
```

---

## 📦 SPACING SCALE

```css
--space-1: 0.25rem    /* 4px */
--space-2: 0.5rem     /* 8px */
--space-3: 0.75rem    /* 12px */
--space-4: 1rem       /* 16px */
--space-5: 1.25rem    /* 20px */
--space-6: 1.5rem     /* 24px */
--space-8: 2rem       /* 32px */
--space-10: 2.5rem    /* 40px */
--space-12: 3rem      /* 48px */
--space-16: 4rem      /* 64px */
--space-20: 5rem      /* 80px */
```

---

## 🎯 COMPONENT TOKENS

### Analytics Cards

```css
/* Card Container */
--card-bg: #FFFFFF
--card-border: #E2E8F0
--card-padding: 1.5rem /* 24px */
--card-radius: 0.5rem  /* 8px */
--card-hover-border: #CBD5E1
--card-hover-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)

/* Metric Value */
--metric-color: #0F172A
--metric-size-sm: 1.5rem    /* 24px */
--metric-size-md: 1.875rem  /* 30px */
--metric-size-lg: 2.25rem   /* 36px */
--metric-weight: 700

/* Metric Label */
--metric-label-color: #64748B
--metric-label-size: 0.75rem
--metric-label-weight: 500
--metric-label-transform: uppercase
--metric-label-spacing: 0.05em
```

### Buttons

```css
/* Primary Button */
--btn-primary-bg: #0F172A
--btn-primary-text: #FFFFFF
--btn-primary-hover-bg: #1E293B
--btn-primary-padding: 0.75rem 1.5rem
--btn-primary-radius: 0.5rem

/* Secondary Button */
--btn-secondary-bg: transparent
--btn-secondary-text: #0F172A
--btn-secondary-border: #E2E8F0
--btn-secondary-hover-bg: #F8FAFC

/* Danger Button */
--btn-danger-bg: #DC2626
--btn-danger-text: #FFFFFF
--btn-danger-hover-bg: #B91C1C
```

### Forms

```css
/* Input Fields */
--input-bg: #FFFFFF
--input-border: #E2E8F0
--input-text: #0F172A
--input-placeholder: #94A3B8
--input-focus-border: #0F172A
--input-padding: 0.75rem
--input-radius: 0.5rem

/* Labels */
--label-color: #334155
--label-size: 0.875rem
--label-weight: 500
```

---

## 🚫 BANNED PATTERNS

### ❌ Never Use:

```css
/* Low contrast text */
text-gray-900 on light backgrounds  /* Use text-slate-900 */
text-gray-600 on any background     /* Use text-slate-600 or text-white/60 */

/* Gradient backgrounds behind text */
background: linear-gradient(...)    /* Use solid colors */

/* Glassmorphism with text */
backdrop-blur with text overlay     /* Use solid backgrounds */

/* Low opacity on primary text */
opacity: 0.5 on headings           /* Use proper color tokens */

/* Decorative interference */
Floating gradient blobs behind cards
Colored shadows on text
Soft glows everywhere
```

---

## ✅ APPROVED PATTERNS

### Typography Combinations

**Analytics Card:**
```tsx
<div className="bg-white border border-slate-200 rounded-lg p-6">
  <div className="text-3xl font-bold text-slate-900">1,234</div>
  <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
    Total Users
  </div>
</div>
```

**Section Header:**
```tsx
<div className="mb-6">
  <h2 className="text-2xl font-semibold text-slate-900 mb-2">
    About
  </h2>
  <p className="text-base text-slate-700 leading-relaxed">
    Body text with proper contrast and readability.
  </p>
</div>
```

**Stat Row:**
```tsx
<div className="flex gap-8 p-4 bg-white border border-slate-200 rounded-lg">
  <div>
    <div className="text-2xl font-bold text-slate-900">892</div>
    <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
      Followers
    </div>
  </div>
</div>
```

---

## 🎨 ACCENT COLORS

### Brand Accents (Use Sparingly)

```css
/* Cyan - Verification, Links */
--accent-cyan: #00FFF1
--accent-cyan-dark: #00CCC2

/* Violet - Premium, Pro */
--accent-violet: #8C00FF
--accent-violet-dark: #7000CC

/* Green - Success, Verified */
--accent-green: #00FF85
--accent-green-dark: #00CC6A
```

### Status Colors

```css
/* Success */
--success: #10B981
--success-bg: #D1FAE5
--success-text: #065F46

/* Warning */
--warning: #F59E0B
--warning-bg: #FEF3C7
--warning-text: #92400E

/* Error */
--error: #EF4444
--error-bg: #FEE2E2
--error-text: #991B1B

/* Info */
--info: #3B82F6
--info-bg: #DBEAFE
--info-text: #1E40AF
```

---

## 📐 LAYOUT TOKENS

### Container Widths
```css
--container-sm: 640px
--container-md: 768px
--container-lg: 1024px
--container-xl: 1280px
--container-2xl: 1536px
```

### Border Radius
```css
--radius-sm: 0.25rem   /* 4px */
--radius-md: 0.5rem    /* 8px */
--radius-lg: 0.75rem   /* 12px */
--radius-xl: 1rem      /* 16px */
--radius-full: 9999px  /* Pills */
```

### Shadows (Minimal)
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-md: 0 1px 3px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.1)

/* NO colored shadows */
/* NO soft glows */
/* NO heavy drop shadows */
```

---

## 🎯 CONTRAST REQUIREMENTS

### WCAG Standards (Minimum)

| Text Type | Light Mode | Dark Mode | Standard |
|-----------|------------|-----------|----------|
| **Primary** | 15:1 | 15:1 | AAA ✅ |
| **Secondary** | 9:1 | 10:1 | AAA ✅ |
| **Muted** | 7:1 | 9:1 | AA ✅ |
| **Subtle** | 4.5:1 | 7.5:1 | AA ✅ |

**All text must meet WCAG AA minimum (4.5:1)**  
**Primary and secondary text should meet AAA (7:1)**

---

## 📱 RESPONSIVE SCALE

### Breakpoints
```css
--breakpoint-sm: 640px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--breakpoint-xl: 1280px
--breakpoint-2xl: 1536px
```

### Typography Scaling
```css
/* Mobile: Reduce by 10-15% */
@media (max-width: 768px) {
  --text-3xl: 1.5rem   /* 24px instead of 30px */
  --text-4xl: 2rem     /* 32px instead of 36px */
}
```

---

## 🔧 TAILWIND CONFIG

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        slate: {
          // Use Tailwind's built-in slate scale
        },
        accent: {
          cyan: '#00FFF1',
          violet: '#8C00FF',
          green: '#00FF85',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

---

## ✅ IMPLEMENTATION CHECKLIST

When building any component:

- [ ] Text contrast meets WCAG AA minimum
- [ ] No gradient backgrounds behind text
- [ ] No glassmorphism with text overlay
- [ ] Numbers are bold and high contrast
- [ ] Labels are uppercase, medium weight
- [ ] Proper spacing hierarchy
- [ ] Clean borders, no gradient borders
- [ ] Minimal shadows, no colored shadows
- [ ] Responsive typography scaling
- [ ] Dark mode uses white text
- [ ] Light mode uses slate text

---

## 🎯 FINAL RULES

1. **IF background is light → text must be dark (slate-900/700/600)**
2. **IF background is dark → text must be white (white/white/70/white/60)**
3. **NO exceptions**
4. **NO gradient text**
5. **NO low opacity primary text**
6. **NO decorative blobs behind content**
7. **NO flipping animations on data cards**
8. **Professional > Trendy**
9. **Clarity > Aesthetics**
10. **Infrastructure > Art**

---

**Linkary is infrastructure. Infrastructure must be sharp, clear, and trustworthy.**

**Use these tokens. Build professional UIs. Ship with confidence.**
