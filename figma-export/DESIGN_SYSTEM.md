# Linkary Design System Documentation

## Overview
Linkary uses a consistent design system across all pages featuring glass-morphism cards, gradient accents, and smooth animations. All components follow the same visual language for a cohesive user experience.

## Core Design Principles

### 1. **Visual Style**
- **Background**: Dark zinc base (`bg-zinc-900`)
- **Glass-morphism**: Translucent cards with backdrop blur
- **Gradients**: Vibrant color gradients for emphasis and visual hierarchy
- **Border Radius**: `rounded-2xl` to `rounded-3xl` for cards
- **Animations**: Smooth transitions with Motion/React

### 2. **Color Palette**
- **Primary**: Indigo to Purple gradient (`from-indigo-500 to-purple-500`)
- **Success**: Emerald shades (`emerald-400`, `emerald-500`)
- **Info**: Blue to Cyan gradient (`from-blue-500 to-cyan-500`)
- **Warning**: Amber shades (`amber-400`, `amber-500`)
- **Accent**: Pink to Rose gradient (`from-pink-500 to-rose-500`)

### 3. **Spacing System**
- **Outer padding**: 24px (`p-6`)
- **Inner card padding**: 16px (`p-4`)
- **Grid spacing**: 12px (`gap-3`)
- **Section spacing**: 24px (`space-y-6`)

## Shared Components

All reusable components are exported from `/src/app/components/SharedComponents.tsx`:

### 1. **GlassCard**
```tsx
<GlassCard hover={true} className="custom-class">
  {children}
</GlassCard>
```
- Translucent background with backdrop blur
- Optional hover effect (scale + border highlight)
- Consistent border and shadow

### 2. **StatCard**
```tsx
<StatCard
  icon={Icon}
  label="Label"
  value="123"
  change="+12%"
  gradient="from-indigo-500/20 to-purple-500/20"
/>
```
- Icon with gradient background
- Label, value, and optional change indicator
- Color-coded change (green for positive, red for negative)

### 3. **ReputationBadge**
```tsx
<ReputationBadge
  icon={Shield}
  label="ETHOS Score"
  value={892}
  color="emerald"
  description="Identity & reputation"
/>
```
- Displays Web3 reputation metrics
- Supports colors: emerald, blue, purple, amber
- Hover effect with scale animation

### 4. **RoleChip**
```tsx
<RoleChip
  label="Fullstack"
  gradient="from-indigo-500/20 to-purple-500/20"
  borderColor="border-indigo-500/30"
  icon={Icon}
/>
```
- Multi-select role tags
- Gradient background with matching border
- Optional icon support

### 5. **SocialCard** (Link3-style)
```tsx
<SocialCard
  icon={Twitter}
  label="Twitter"
  value="@username"
  url="https://twitter.com/username"
  hoverColor="hover:bg-blue-500/10 hover:border-blue-500/20"
/>
```
- Social media link cards
- External link indicator
- Platform-specific hover colors

### 6. **ReviewCard**
```tsx
<ReviewCard
  author="John Doe"
  authorType="Project"
  avatar="https://..."
  rating={5}
  date="Feb 8, 2026"
  title="Great work!"
  comment="Excellent collaboration..."
  verified={true}
  tags={["On Time", "Professional"]}
/>
```
- Bidirectional review system
- Star ratings
- Verified badge support
- Tag labels

### 7. **FilterPill**
```tsx
<FilterPill
  label="DeFi"
  active={selectedCategory === "DeFi"}
  onClick={() => setSelectedCategory("DeFi")}
/>
```
- Category/role filtering
- Active state with gradient
- Smooth transitions

### 8. **StatusBadge**
```tsx
<StatusBadge
  status="active"  // active | inactive | pending | completed
  label="Open"
/>
```
- Status indicators with color coding
- Optional pulse animation for active states

### 9. **EcosystemCard**
```tsx
<EcosystemCard
  name="Uniswap"
  category="DEX"
  description="Leading decentralized exchange"
  logo="https://..."
  status="Integrated"
  gradient="from-pink-500/20 to-rose-500/20"
  borderColor="border-pink-500/30"
  url="https://..."
/>
```
- Displays ecosystem projects or customer portfolio
- Gradient backgrounds
- External link support

### 10. **MemberCard**
```tsx
<MemberCard
  name="Alex Morgan"
  role="Founder & CEO"
  avatar="https://..."
  ethos={892}
  verified={true}
  onClick={() => {}}
/>
```
- Team member display
- Reputation score
- Verified badge
- Interactive (clickable)

### 11. **AchievementCard**
```tsx
<AchievementCard
  icon={Award}
  title="Top Rated 2025"
  description="Recognized as #1 DeFi project"
  color="from-amber-500/10 to-orange-500/10"
  borderColor="border-amber-500/20"
/>
```
- Milestone and achievement display
- Icon with gradient background
- Hover scale effect

### 12. **OpportunityCard**
```tsx
<OpportunityCard
  title="Senior Solidity Developer"
  type="Full-time"
  budget="€8,000 - €12,000/mo"
  deadline="2026-03-01"
  status="active"
  onClick={() => {}}
/>
```
- Job/opportunity listings
- Status indicator
- Optional deadline

### 13. **SectionHeader**
```tsx
<SectionHeader
  icon={Building2}
  title="About"
  subtitle="Learn more about this project"
  action={<button>View All</button>}
  gradient="from-indigo-500/20 to-purple-500/20"
  borderColor="border-indigo-500/30"
/>
```
- Consistent section headers
- Icon with gradient background
- Optional action button

### 14. **EmptyState**
```tsx
<EmptyState
  icon={Search}
  title="No results found"
  description="Try adjusting your filters"
  action={<button>Clear Filters</button>}
/>
```
- Empty state messaging
- Optional action button
- Centered layout

## Animation Variants

Exported from `SharedComponents.tsx`:

```tsx
// Fade in from bottom
fadeInUp: {
  initial: { opacity: 0, y: 20, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
}

// Fade in from left
fadeInRight: {
  initial: { opacity: 0, x: -20, filter: "blur(10px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
}

// Fade in from right
fadeInLeft: {
  initial: { opacity: 0, x: 20, filter: "blur(10px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
}

// Scale in
scaleIn: {
  initial: { opacity: 0, scale: 0.95, filter: "blur(10px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
}
```

## Page Structure

All pages follow a 3-column layout on desktop:

### **Left Sidebar** (320px)
- Identity/Profile card
- Reputation scores
- Social links
- Quick stats

### **Center Content** (flex-1)
- Main content area
- Highlights/stats grid
- About section
- Reviews
- Case studies/portfolio

### **Right Sidebar** (280px)
- Related items (team, projects, events)
- Quick actions
- Achievements
- Contact info

### **Responsive Behavior**
- **Mobile**: Single column, stacked
- **Tablet**: 2-column layout
- **Desktop**: Full 3-column layout

## Pages

### 1. **Creator Profile Page** (`/src/app/components/CreatorProfilePage.tsx`)
- Individual user/creator profiles
- Multi-role tags
- Portfolio & case studies
- Open to opportunities status
- Current projects (team/affiliate/ambassador)
- Upcoming events (X Spaces, podcasts)
- Reviews from projects

### 2. **Brand/Project Profile Page** (`/src/app/components/BrandProfilePage.tsx`)
- Company/project profiles
- Ecosystem section with category filtering
- Customer portfolio
- Team members
- Open opportunities
- Reviews
- Achievements

### 3. **Dashboard Page** (`/src/app/components/DashboardPage.tsx`)
- Analytics overview
- Multi-brand support
- Revenue tracking
- Activity timeline
- Upcoming events
- Quick actions

### 4. **Discovery Page** (`/src/app/components/DiscoveryPage.tsx`)
- Unified discovery for Creators and Projects
- Advanced filtering (roles, categories, reputation)
- Search functionality
- Tabbed interface
- Card-based results

### 5. **Calendar Page** (`/src/app/components/CalendarPage.tsx`)
- Month/week/day views
- Event management
- X Spaces & podcast integration
- Speaker applications (Pro feature)
- Event filtering

### 6. **User Profile Page** (`/src/app/components/UserProfilePage.tsx`)
- Public user profiles
- Case studies
- Project history
- Social proof

## Web3 Reputation System

All profiles prominently display three reputation metrics:

### 1. **ETHOS Score**
- Identity & reputation verification
- Color: Emerald (`emerald-400`)
- Icon: Shield
- Range: 0-1000

### 2. **XScore**
- Social proof & reach
- Color: Blue (`blue-400`)
- Icon: Activity
- Range: 0-1000

### 3. **Platform Reputation Index**
- Composite trust score
- Color: Purple (`purple-400`)
- Icon: Award
- Range: 0-100

## Features Across All Pages

✅ **Glass-morphism cards** with consistent styling
✅ **Category/role filtering** with FilterPills
✅ **Bidirectional review system** (Projects ↔ Creators)
✅ **Web3 reputation scores** prominently displayed
✅ **Link3-style social cards** with platform-specific colors
✅ **Status badges** with color coding
✅ **Verified badges** (CheckCircle2 icon in cyan-400)
✅ **Gradient backgrounds** for visual interest
✅ **Hover effects** with scale and border highlights
✅ **Smooth animations** using Motion/React
✅ **Responsive 3-column layouts**
✅ **Consistent spacing** and typography
✅ **Empty states** with clear messaging

## Usage Guidelines

### Importing Shared Components
```tsx
import {
  GlassCard,
  StatCard,
  ReputationBadge,
  RoleChip,
  SocialCard,
  ReviewCard,
  FilterPill,
  StatusBadge,
  MemberCard,
  AchievementCard,
  EcosystemCard,
  OpportunityCard,
  SectionHeader,
  EmptyState,
  fadeInUp,
  fadeInRight,
  fadeInLeft,
} from "./SharedComponents";
```

### Creating New Pages
1. Import shared components
2. Use 3-column layout structure
3. Apply animation variants to sections
4. Use consistent spacing (p-6, p-8)
5. Follow gradient color scheme
6. Add hover effects to interactive elements
7. Include reputation scores where relevant
8. Use FilterPills for category/role selection
9. Implement StatusBadges for availability/status

### Best Practices
- Always use GlassCard for card containers
- Use StatCard for metrics display
- Apply fadeInUp/fadeInRight/fadeInLeft for stagger animations
- Use ReputationBadge for Web3 scores
- Include verified badges (CheckCircle2) for verified entities
- Use RoleChip for tags and labels
- Implement filtering with FilterPill components
- Show empty states with EmptyState component
- Use consistent icon sizing (w-4 h-4 or w-5 h-5)
- Apply hover effects (hover:scale-105, hover:border-white/20)

## Color Usage

### Gradients
- **Primary Actions**: `from-indigo-500 to-purple-500`
- **Success/Positive**: `from-emerald-500 to-cyan-500`
- **Warning**: `from-amber-500 to-orange-500`
- **Accent**: `from-pink-500 to-rose-500`
- **Info**: `from-blue-500 to-cyan-500`

### Text Colors
- **Primary**: `text-white`
- **Secondary**: `text-neutral-300`
- **Muted**: `text-neutral-400`
- **Disabled**: `text-neutral-600`

### Border Colors
- **Default**: `border-white/10`
- **Hover**: `border-white/20`
- **Active**: `border-white/30`
- **Colored**: `border-{color}-500/30`

## Iconography

Using Lucide React icons with consistent sizing:
- **Small**: `w-3 h-3` (12px)
- **Medium**: `w-4 h-4` (16px)
- **Large**: `w-5 h-5` (20px)
- **XLarge**: `w-6 h-6` (24px)

## Typography

- **Headings**: `font-bold text-white`
- **Body**: `text-neutral-300`
- **Labels**: `text-xs uppercase tracking-wider text-neutral-400`
- **Stats/Numbers**: `font-bold text-white` with colored accents

## Accessibility

- All interactive elements have hover states
- Status badges use both color and text
- Icons paired with text labels
- Adequate color contrast ratios
- Focus states on interactive elements

---

**Note**: This design system ensures visual consistency across the entire Linkary platform, creating a cohesive and professional Web3 reputation infrastructure.
