# Linkary Dual Profile System

## Overview

Linkary now implements a comprehensive dual profile system with two distinct viewing modes:

1. **MODE A: Public Standalone Profile** - Link3-style standalone page for public viewing
2. **MODE B: Logged-In Management View** - Dashboard-style profile management

## Architecture

### Global URL Structure

All entities use a unified global namespace:
```
linkary.xyz/{slug}
```

No `/u/` prefix or `@` symbol. Entity type is detected internally.

### Entity Types

- **Individual** - Creators, founders, designers, etc.
- **Project** - Web3 projects, protocols, dApps
- **Company/Foundation** - Companies, DAOs, foundations
- **Brand** - Marketing brands, consumer brands
- **Agency** - Marketing companies, service providers

---

## MODE A: Public Standalone Profile

**Used when:**
- Viewer is not logged in
- Viewer is visiting a shared link
- Viewer is viewing someone else's profile publicly

**Routes:**
- `/publicCreator` → Individual profile
- `/publicProject` → Project profile (with token support)

**UI Characteristics:**
- ✅ No sidebar or dashboard navigation
- ✅ Minimal sticky header with logo, copy link, share, and login buttons
- ✅ Hero section with avatar, name, verification badge, entity type
- ✅ Social icons row (clean monochrome icons)
- ✅ Link builder section (full-width link cards)
- ✅ Founders/team section with video embeds
- ✅ Token price card (for projects with tokens)
- ✅ Partnerships, case studies, and verified reviews
- ✅ Clean footer
- ✅ Single-column scrollable layout
- ✅ WCAG AA compliant contrast

### Components

#### `/src/app/components/profile/SocialIconsRow.tsx`
Displays social media icons in a clean row.

**Props:**
```typescript
interface SocialLink {
  platform: 'x' | 'telegram' | 'discord' | 'youtube' | 'website' | 'github' | 'linkedin';
  url: string;
}

interface SocialIconsRowProps {
  links: SocialLink[];
}
```

#### `/src/app/components/profile/TokenPriceCard.tsx`
Shows live token price data with external links.

**Props:**
```typescript
interface TokenData {
  ticker: string;
  name: string;
  contractAddress: string;
  chain: string;
  price?: string;
  change24h?: number;
  marketCap?: string;
  volume24h?: string;
  links?: {
    coinmarketcap?: string;
    coingecko?: string;
    dexscreener?: string;
  };
}
```

#### `/src/app/components/profile/FounderCard.tsx`
Displays founder/team member with optional video embed.

**Props:**
```typescript
interface FounderData {
  name: string;
  role: string;
  handle?: string;
  ethos?: number;
  xscore?: number;
  socialPower?: number;
  verified?: boolean;
  videoUrl?: string;  // YouTube, Loom, or Vimeo URL
  videoCaption?: string;
}
```

#### `/src/app/components/profile/VerificationBadge.tsx`
Shows verification state for relationships.

**Props:**
```typescript
type VerificationState = 'verified' | 'pending' | 'requested' | 'community';

interface VerificationBadgeProps {
  state: VerificationState;
  label?: string;
  size?: 'sm' | 'md';
}
```

**States:**
- `verified` - Green badge with checkmark (mutual verification)
- `pending` - Yellow badge with clock (awaiting response)
- `requested` - Blue badge with alert (request sent)
- `community` - Gray badge (one-way follow)

---

## MODE B: Logged-In Management View

**Used when:**
- User is logged in and viewing their own profile
- User is logged in and viewing a brand/company/project they own or have edit rights for

**Routes:**
- `/profile` → Old ProfilePage with gradient design (3-column dashboard)
- `/creatorProfile` → UnifiedProfileLayout for creators
- `/brandProfile` → UnifiedProfileLayout for brands

**UI Characteristics:**
- ✅ Full sidebar navigation
- ✅ Topbar with global search
- ✅ SectionTitle bar with "Share" and "Connect" buttons
- ✅ 3-column grid layout (`lg:grid-cols-3`)
- ✅ Left profile card (1/3 width)
- ✅ Right content area (2/3 width)
- ✅ Edit controls visible only for owners/editors
- ✅ Same data, different presentation

### Edit Permissions

**Permission Indicators:**
- "Owner" badge - Full edit rights
- "Editor" badge - Limited edit rights
- No badge - View only

**Edit Controls:**
- Edit bio icon
- Add role button
- Add link button
- Add partnership button
- Add case study button
- Add featured work button

All inline, subtle icons/buttons that don't change layout.

---

## Token Section (MODE A - Projects Only)

When creating a project profile, ask:
> "Does this project have a token?"

**If YES:**
1. Collect token data:
   - Ticker symbol (e.g., MATRIX)
   - Token name (e.g., MatrixPay Token)
   - Contract address
   - Chain (Ethereum, Polygon, etc.)
2. Add optional links:
   - CoinMarketCap URL
   - CoinGecko URL
   - Dexscreener URL
3. Display `<TokenPriceCard />` in the public profile

**Token Price Card includes:**
- Token name and ticker
- Current price (if available)
- 24h change with trend indicator
- Market cap and volume
- External links to CMC/CG/Dexscreener
- Contract address (truncated)

**Note:** UI only - no backend calculations or live API integrations in this implementation.

---

## Founders/Team Section (MODE A)

For **Projects**, **Companies**, and **Brands**, display team members with:

- Founder/team member cards
- Name, role, handle
- Reputation scores (ETHOS, XScore, Social)
- Verification badge
- **Video embed slot** (YouTube/Loom/Vimeo)
  - Clean responsive iframe
  - Optional caption
  - Call-to-action (optional)

**Video Embed:**
```typescript
{
  name: 'Sarah Chen',
  role: 'CTO & Co-Founder',
  videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  videoCaption: 'Sarah explains MatrixPay\'s vision',
}
```

---

## Verification States

All relationships display verification state:

| State | Badge Color | Icon | Meaning |
|-------|------------|------|---------|
| `verified` | Green | ✓ | Mutual verification complete |
| `pending` | Yellow | ⏱ | Awaiting response |
| `requested` | Blue | ⓘ | Request sent |
| `community` | Gray | - | One-way follow |

**Use cases:**
- Partnerships - Must be verified (mutual)
- Worked With / Worked For - Must be verified (mutual)
- Ambassadors / Affiliates - Can be verified or community
- Ecosystems - Can be verified or community
- Customers - Verified deals only

---

## Responsive Design

### Desktop (1440px)
- Full 3-column layout for MODE B
- Full-width sections for MODE A

### Tablet (1024px)
- Stacked layout for MODE B
- Wrapped sections for MODE A

### Mobile (390px)
- Single column
- Social icons wrap
- Token card full width
- Buttons stack

---

## Contrast & Accessibility (WCAG AA)

### Color System

```css
/* Backgrounds */
--bg-primary: #FFFFFF;
--bg-secondary: #F6F7F9;
--bg-dark: #0F1115;

/* Text */
--text-primary: #0F172A;
--text-secondary: #334155;
--text-muted: #64748B;
--text-on-dark: #FFFFFF;
```

### Rules

1. ✅ Never use light text on light background
2. ✅ Body text opacity never below 85%
3. ✅ Remove pastel overlays behind text
4. ✅ Ensure cards are readable and professional
5. ✅ All interactive elements meet 4.5:1 contrast ratio

---

## Data Structure

### Public Profile Data Interface

```typescript
interface PublicProfileData {
  type: 'individual' | 'project' | 'company' | 'brand' | 'agency';
  slug: string;
  name: string;
  handle?: string;
  tagline?: string;
  bio?: string;
  location?: string;
  verified?: boolean;
  
  // Reputation
  ethos?: number;
  xscore?: number;
  reputationIndex?: number;
  socialPower?: number;
  
  // Reviews
  reviews?: {
    avg: number;
    count: number;
  };
  
  // Social & Links
  socialLinks?: SocialLink[];
  links?: Array<{
    label: string;
    url: string;
    clicks?: number;
  }>;
  
  // Team (for projects/companies)
  founders?: FounderData[];
  
  // Token (for projects/companies)
  token?: TokenData;
  
  // Relationships
  partnerships?: Array<{
    name: string;
    type: string;
    verified: boolean;
  }>;
  ambassadorOf?: string[];
  
  // Content
  featuredWork?: Array<{
    title: string;
    image?: string;
    views: number;
  }>;
  caseStudies?: Array<{
    id: string;
    projectName: string;
    role: string;
    duration: string;
    results: { metric: string; value: string };
    verified: boolean;
  }>;
  reviewItems?: Array<{
    by: string;
    byType: string;
    rating: number;
    title: string;
    text: string;
    date: string;
    verifiedDeal: boolean;
  }>;
}
```

---

## Implementation Checklist

### MODE A (Public Standalone) ✅
- [x] Minimal header (logo, copy link, share, login)
- [x] Hero section (avatar, name, verified, type, bio)
- [x] Social icons row component
- [x] Link builder section
- [x] Reputation score pills
- [x] Reviews rating display
- [x] Founders/team cards with video embeds
- [x] Token price card component
- [x] Partnerships with verification badges
- [x] Ambassador of section
- [x] Featured work grid
- [x] Case studies with results
- [x] Verified reviews only
- [x] Clean footer
- [x] WCAG AA contrast
- [x] Responsive design

### MODE B (Logged-In Management) ✅
- [x] ProfilePage (old gradient design) restored
- [x] 3-column grid layout
- [x] Left profile card (scores, links, partnerships)
- [x] Right content area (work, events, case studies, reviews)
- [x] SectionTitle with Share/Connect buttons
- [x] Edit controls for owners (inline, subtle)

### Global Components ✅
- [x] SocialIconsRow
- [x] TokenPriceCard
- [x] FounderCard
- [x] VerificationBadge
- [x] Stars rating component

---

## Usage Examples

### Individual Profile (Public)
```tsx
<PublicStandalonePage profileType="individual" />
```

### Project Profile with Token (Public)
```tsx
<PublicStandalonePage profileType="project" />
```

### Logged-In Management (Old Design)
```tsx
<ProfilePage setRoute={setRoute} />
```

### Logged-In Management (Unified Design)
```tsx
<CreatorProfilePage setRoute={setRoute} />
<BrandProfilePage setRoute={setRoute} brandData={data} />
```

---

## Next Steps & Suggestions

1. **Add Edit Mode Toggle** - Allow owners to switch between public preview and edit mode
2. **URL Routing** - Implement proper URL routing with `/:slug` pattern
3. **Permission System** - Add role-based access control (Owner, Editor, Viewer)
4. **Video Validation** - Add support for Loom and Vimeo URL parsing
5. **Token API Integration** - Connect to CoinMarketCap/CoinGecko APIs for live data
6. **SEO Meta Tags** - Add Open Graph and Twitter Card meta tags
7. **Analytics Tracking** - Track profile views, link clicks, social interactions

---

## Files Created

```
/src/app/components/profile/
├── SocialIconsRow.tsx
├── TokenPriceCard.tsx
├── FounderCard.tsx
├── VerificationBadge.tsx
└── PublicStandaloneProfile.tsx

/src/app/components/
├── PublicStandalonePage.tsx  (demo with sample data)
└── ui/stars.tsx
```

---

## Design Philosophy

**Public Profile (MODE A):** Clean, minimal, shareable, SEO-friendly
- Focus on credibility and reputation
- Easy to share on social media
- No distractions, clear call-to-actions
- Mobile-first responsive design

**Management View (MODE B):** Comprehensive, data-rich, powerful
- Full dashboard experience
- Advanced analytics and insights
- Edit controls and settings
- Desktop-optimized workflow

Both modes use the same data source, just presented differently based on context.

---

**Built with Linkary's infrastructure-grade design system**
Premium · Minimal · Data-first · WCAG AA Compliant
