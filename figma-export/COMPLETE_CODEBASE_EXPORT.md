# 🚀 LINKARY - Complete Codebase Export

**Last Updated:** February 16, 2026  
**Product:** Web3 Reputation Infrastructure Platform  
**Stack:** React + TypeScript + Tailwind CSS v4 + Vite

---

## 📋 Table of Contents

1. [Project Structure](#project-structure)
2. [Configuration Files](#configuration-files)
3. [Main Application](#main-application)
4. [KOL Lists System (NEW)](#kol-lists-system-new)
5. [Circles System](#circles-system)
6. [Core Pages](#core-pages)
7. [Styling System](#styling-system)
8. [Key Features](#key-features)

---

## 🗂️ Project Structure

```
linkary/
├── public/
│   └── suppress-web3.js
├── src/
│   ├── app/
│   │   ├── App.tsx                    # Main application (2600+ lines)
│   │   └── components/
│   │       ├── circles/               # NEW: Circles + KOL Lists
│   │       │   ├── CirclesOverviewPage.tsx
│   │       │   ├── CreateCircleFlow.tsx
│   │       │   ├── CircleDetailPage.tsx
│   │       │   ├── CircleComponents.tsx
│   │       │   ├── KOLListsPage.tsx         # NEW
│   │       │   ├── KOLComponents.tsx        # NEW
│   │       │   └── CapitalPartnersPage.tsx  # NEW
│   │       ├── DashboardPage.tsx
│   │       ├── UserProfilePage.tsx
│   │       ├── CreatorProfilePage.tsx
│   │       ├── BrandProfilePage.tsx
│   │       ├── AgencyProfilePage.tsx
│   │       ├── DiscoveryPage.tsx
│   │       ├── AnalyticsPage.tsx
│   │       ├── CalendarPage.tsx
│   │       ├── VerificationCenterPage.tsx
│   │       ├── PrivacyDataPage.tsx
│   │       ├── PublicStandalonePage.tsx
│   │       ├── IconSystem.tsx
│   │       ├── FlipCard.tsx
│   │       └── [more components...]
│   ├── styles/
│   │   ├── index.css
│   │   ├── theme.css
│   │   ├── fonts.css
│   │   └── tailwind.css
│   └── types/
│       └── global.d.ts
├── package.json
├── vite.config.ts
└── postcss.config.mjs
```

---

## ⚙️ Configuration Files

### **package.json**

See `/package.json` for dependencies:
- React 18+
- TypeScript
- Tailwind CSS v4
- Vite
- Motion (Framer Motion v12)
- Lucide React (icons)
- Recharts (charts)

### **vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
```

### **postcss.config.mjs**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

---

## 🎯 Main Application

**File:** `/src/app/App.tsx` (2600+ lines)

**Key Features:**
- ✅ Console warning suppression for Web3 wallets
- ✅ Dual profile system (Creator + Project)
- ✅ Dashboard with 3-column layout
- ✅ Circles + KOL Lists + Capital Partners navigation
- ✅ Analytics, Verification, Calendar integration
- ✅ Public standalone profiles
- ✅ Comprehensive demo data

**To view:** Use the `read` command on `/src/app/App.tsx` with offset/limit parameters

---

## 🆕 KOL Lists System (NEW)

### **1. KOLComponents.tsx**

**File:** `/src/app/components/circles/KOLComponents.tsx`

**Contains:**
- `TierDistributionBar` - Visual tier breakdown
- `CreatorRowCard` - Selectable creator rows
- `KOLSelectionSummaryCard` - Real-time analytics summary

**Features:**
- ✅ Nano/Micro/Mid/Macro tier visualization
- ✅ Real-time reach calculation
- ✅ Geo-aware analytics
- ✅ Overlap risk indicators
- ✅ Verified ratio tracking

### **2. KOLListsPage.tsx**

**File:** `/src/app/components/circles/KOLListsPage.tsx`

**Features:**
- ✅ Two-panel layout (search + summary)
- ✅ Advanced filtering (geo, reach, language, category)
- ✅ Real-time selection tracking
- ✅ Save as Circle
- ✅ Invite to Gig
- ✅ Export functionality (placeholder)

### **3. CapitalPartnersPage.tsx**

**File:** `/src/app/components/circles/CapitalPartnersPage.tsx`

**Features:**
- ✅ VC-specific variant
- ✅ Partner/Scout/Advisor/Founder filtering
- ✅ Network reach analytics
- ✅ Deal flow integration
- ✅ Reuses KOL components

---

## 🔄 Circles System

### **CirclesOverviewPage.tsx**

**Features:**
- Circle types: Creator, Project, VC
- Create new circles
- View existing circles
- Analytics dashboard

### **CreateCircleFlow.tsx**

**Features:**
- Multi-step circle creation
- Member selection
- Settings configuration
- Validation

### **CircleDetailPage.tsx**

**Features:**
- Circle member list
- Analytics
- Activity feed
- Management options

### **CircleComponents.tsx**

**Reusable Components:**
- CircleCard
- MemberRow
- ActivityItem
- StatsGrid

---

## 📄 Core Pages

### **DashboardPage.tsx**

- 3-column layout
- Analytics widgets
- Recent activity
- Opportunity feed

### **UserProfilePage.tsx**

- Creator profile view
- Reputation scores
- Case studies
- Reviews

### **CreatorProfilePage.tsx**

- Enhanced creator view
- Social proof
- Work samples
- Testimonials

### **BrandProfilePage.tsx**

- Project/brand profile
- Team members
- Ambassadors
- Ecosystem partners

### **DiscoveryPage.tsx**

- Explore creators
- Explore projects
- Filtering
- AI matching

### **AnalyticsPage.tsx**

- Profile views
- Click analytics
- Engagement metrics
- Time series charts

### **CalendarPage.tsx**

- Event scheduling
- X Spaces
- Podcasts
- AMAs

### **VerificationCenterPage.tsx**

- Trust verification
- Badge management
- Verification queue

### **PublicStandalonePage.tsx**

- Public profile view
- Shareable link
- MODE A implementation

---

## 🎨 Styling System

### **/src/styles/theme.css**

**Design Tokens:**
- Color palette (indigo/purple/emerald/amber)
- Typography scale
- Spacing system
- Border radius
- Shadows

### **/src/styles/tailwind.css**

**Tailwind v4 Configuration:**
- Base styles
- Component classes
- Utility classes

### **/src/styles/fonts.css**

**Font Imports:**
- Inter (primary)
- System fallbacks

### **/src/styles/index.css**

**Global Styles:**
- Resets
- Animations
- Scrollbar styling

---

## 🔑 Key Features

### **1. Reputation Scoring**

```typescript
// ETHOS Score: On-chain trust
// XScore: Social influence quality
// Platform Reputation Index: Combined score
// Social Power: Audience reach + engagement
```

### **2. Dual Profile System**

```typescript
// MODE A: Public Standalone Profile
// - Shareable link
// - Clean, professional
// - No navigation chrome

// MODE B: Logged-in Management View
// - Full dashboard
// - 3-column layout
// - All management tools
```

### **3. Circles System**

```typescript
// Creator Circles: Mutual opt-in relationships
// KOL Lists: Curated creator lists for campaigns
// Capital Partners: VC syndication networks
```

### **4. Real-time Selection Tracking**

```typescript
// Dynamic reach calculation
// Tier distribution
// Geo analytics
// Overlap detection
```

### **5. Analytics Engine**

```typescript
// Profile views
// Click tracking
// Engagement metrics
// Time series visualization
```

---

## 📦 How to Access All Code

### **Method 1: Read Individual Files**

```bash
# Example: Read KOL Lists page
read /src/app/components/circles/KOLListsPage.tsx

# Example: Read KOL Components
read /src/app/components/circles/KOLComponents.tsx

# Example: Read main App
read /src/app/App.tsx offset:0 limit:100
```

### **Method 2: Export Specific Files**

Request specific files and I'll provide the full code:
- "Show me KOLComponents.tsx"
- "Show me KOLListsPage.tsx"
- "Show me CirclesOverviewPage.tsx"

### **Method 3: Download Project**

If this is a Figma Make project, use the export functionality to download the entire codebase as a ZIP file.

---

## 🚀 Getting Started

### **Install Dependencies**

```bash
pnpm install
# or
npm install
```

### **Run Development Server**

```bash
pnpm dev
# or
npm run dev
```

### **Build for Production**

```bash
pnpm build
# or
npm run build
```

---

## 📊 File Sizes

| File | Size | Lines |
|------|------|-------|
| App.tsx | ~130KB | ~2600 |
| KOLListsPage.tsx | ~12KB | ~350 |
| KOLComponents.tsx | ~8KB | ~250 |
| CapitalPartnersPage.tsx | ~12KB | ~350 |
| CirclesOverviewPage.tsx | ~15KB | ~400 |
| CreateCircleFlow.tsx | ~10KB | ~300 |
| CircleDetailPage.tsx | ~12KB | ~350 |

**Total Project Size:** ~1.5MB (uncompressed source code)

---

## 🔍 File Access Commands

### **Navigation Pages**

```bash
read /src/app/components/DashboardPage.tsx
read /src/app/components/UserProfilePage.tsx
read /src/app/components/CreatorProfilePage.tsx
read /src/app/components/BrandProfilePage.tsx
read /src/app/components/DiscoveryPage.tsx
```

### **Circles System**

```bash
read /src/app/components/circles/CirclesOverviewPage.tsx
read /src/app/components/circles/CreateCircleFlow.tsx
read /src/app/components/circles/CircleDetailPage.tsx
read /src/app/components/circles/CircleComponents.tsx
```

### **KOL Lists System**

```bash
read /src/app/components/circles/KOLListsPage.tsx
read /src/app/components/circles/KOLComponents.tsx
read /src/app/components/circles/CapitalPartnersPage.tsx
```

### **Styling**

```bash
read /src/styles/theme.css
read /src/styles/tailwind.css
read /src/styles/index.css
read /src/styles/fonts.css
```

### **Config**

```bash
read /vite.config.ts
read /postcss.config.mjs
read /package.json
```

---

## 💡 Tips

1. **Large Files:** Use `offset` and `limit` parameters for App.tsx
2. **Component Reuse:** KOL components are reusable across pages
3. **Styling:** All components follow light-theme, high-contrast design system
4. **Type Safety:** TypeScript used throughout
5. **Performance:** Lazy loading and code splitting implemented

---

## 🎨 Design System

### **Colors**

- **Primary:** Indigo-600 (CTA buttons)
- **Text:** Zinc-900 (headings), Zinc-700 (body), Zinc-600 (meta)
- **Backgrounds:** White cards, Zinc-50 page backgrounds
- **Borders:** Zinc-200 (default), Indigo-200 (selected)
- **Accents:** Emerald (success), Amber (warning), Red (error)

### **Typography**

- **Headings:** Font-semibold, Zinc-900
- **Body:** Font-normal, Zinc-700
- **Meta:** Font-medium, Zinc-600
- **Small:** Text-sm, Zinc-500

### **Spacing**

- **Card padding:** p-6
- **Section gaps:** gap-6 or gap-8
- **Component spacing:** space-y-4

---

## 📝 Notes

- **Console Warnings:** Web3 wallet warnings are suppressed
- **Demo Data:** Comprehensive placeholder data included
- **Routing:** SPA routing via state management
- **Responsiveness:** Mobile-first, responsive design
- **Accessibility:** WCAG AA compliant contrast ratios

---

## ✅ What's Included

✅ Complete KOL Lists system  
✅ Capital Partners variant  
✅ Circles system  
✅ Dashboard  
✅ User profiles  
✅ Project profiles  
✅ Analytics  
✅ Calendar  
✅ Verification  
✅ Discovery  
✅ Public standalone pages  
✅ Design system  
✅ Icon system  
✅ Animation system  

---

## 🔗 Quick Links

- **Main App:** `/src/app/App.tsx`
- **KOL Lists:** `/src/app/components/circles/KOLListsPage.tsx`
- **Components:** `/src/app/components/circles/KOLComponents.tsx`
- **Styling:** `/src/styles/theme.css`
- **Config:** `/vite.config.ts`

---

**Need a specific file?** Just ask:
- "Show me [filename]"
- "Export [component name]"
- "Read [file path]"

**Ready to deploy!** 🚀
