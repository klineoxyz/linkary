# Copy-Paste Code Snippets

Quick reference for implementing the dual profile system.

---

## 1. Import Components

```tsx
// In your component file
import { PublicStandaloneProfile, PublicProfileData } from './components/profile/PublicStandaloneProfile';
import { SocialIconsRow, SocialLink } from './components/profile/SocialIconsRow';
import { TokenPriceCard, TokenData } from './components/profile/TokenPriceCard';
import { FounderCard, FounderData } from './components/profile/FounderCard';
import { VerificationBadge } from './components/profile/VerificationBadge';
```

---

## 2. Define Profile Data

### Individual Creator Profile

```tsx
const individualProfile: PublicProfileData = {
  type: 'individual',
  slug: 'muazxinthi',
  name: 'Muaz Xinthi',
  handle: 'Muazxinthi',
  bio: 'Creator economy operator. Web3 GTM, research, and partnerships.',
  location: 'Berlin',
  verified: true,
  
  // Reputation scores
  ethos: 842,
  xscore: 771,
  reputationIndex: 86,
  socialPower: 823,
  
  // Reviews
  reviews: {
    avg: 4.8,
    count: 37,
  },
  
  // Social links
  socialLinks: [
    { platform: 'x', url: 'https://x.com/muazxinthi' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/muazxinthi' },
    { platform: 'telegram', url: 'https://t.me/muazxinthi' },
    { platform: 'website', url: 'https://linkary.xyz' },
  ],
  
  // Link builder
  links: [
    { label: 'Portfolio', url: 'https://example.com/portfolio', clicks: 412 },
    { label: 'Case Studies', url: 'https://example.com/cases', clicks: 324 },
    { label: 'Media Kit', url: 'https://example.com/media', clicks: 156 },
  ],
  
  // Relationships
  ambassadorOf: ['MatrixPay', 'Gemini Labs'],
  
  partnerships: [
    { name: 'Chainlink', type: 'Infrastructure Partner', verified: true },
    { name: 'Polygon', type: 'Ecosystem Partner', verified: true },
  ],
  
  // Content
  featuredWork: [
    { title: 'MatrixPay GTM Strategy', views: 1240 },
    { title: 'Web3 Creator Playbook', views: 892 },
  ],
  
  caseStudies: [
    {
      id: 'cs-1',
      projectName: 'MatrixPay',
      role: 'Content Creator & Growth Lead',
      duration: '3 months',
      results: { metric: 'Engagement Rate', value: '+340%' },
      verified: true,
    },
  ],
  
  reviewItems: [
    {
      by: 'MatrixPay',
      byType: 'project',
      rating: 5,
      title: 'Fast delivery and sharp strategy',
      text: 'Great comms, shipped assets on time.',
      date: '2026-02-02',
      verifiedDeal: true,
    },
  ],
};
```

### Project Profile with Token

```tsx
const projectProfile: PublicProfileData = {
  type: 'project',
  slug: 'matrixpay',
  name: 'MatrixPay',
  tagline: 'Payments + creator bounties for Web3 teams',
  verified: true,
  
  ethos: 721,
  xscore: 806,
  reputationIndex: 88,
  socialPower: 794,
  
  reviews: {
    avg: 4.7,
    count: 29,
  },
  
  socialLinks: [
    { platform: 'x', url: 'https://x.com/matrixpay' },
    { platform: 'discord', url: 'https://discord.gg/matrixpay' },
    { platform: 'telegram', url: 'https://t.me/matrixpay' },
    { platform: 'website', url: 'https://matrixpay.xyz' },
    { platform: 'github', url: 'https://github.com/matrixpay' },
  ],
  
  links: [
    { label: 'Documentation', url: 'https://docs.matrixpay.xyz', clicks: 8420 },
    { label: 'Start Building', url: 'https://app.matrixpay.xyz', clicks: 3210 },
    { label: 'Careers', url: 'https://matrixpay.xyz/careers', clicks: 1560 },
  ],
  
  // Founders with video embeds
  founders: [
    {
      name: 'Sarah Chen',
      role: 'CTO & Co-Founder',
      handle: 'sarahchen',
      ethos: 892,
      xscore: 654,
      socialPower: 712,
      verified: true,
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      videoCaption: 'Sarah explains MatrixPay\'s vision',
    },
    {
      name: 'Alex Kim',
      role: 'Lead Designer',
      handle: 'alexkim',
      ethos: 743,
      xscore: 821,
      socialPower: 789,
      verified: true,
    },
  ],
  
  // Token data
  token: {
    ticker: 'MATRIX',
    name: 'MatrixPay Token',
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'Ethereum',
    price: '2.34',
    change24h: 5.67,
    marketCap: '42.5M',
    volume24h: '8.9M',
    links: {
      coinmarketcap: 'https://coinmarketcap.com/currencies/matrixpay',
      coingecko: 'https://coingecko.com/en/coins/matrixpay',
      dexscreener: 'https://dexscreener.com/ethereum/0x1234',
    },
  },
  
  partnerships: [
    { name: 'Chainlink', type: 'Oracle Partner', verified: true },
    { name: 'Polygon', type: 'Infrastructure Partner', verified: true },
  ],
};
```

---

## 3. Render Public Profile

```tsx
// MODE A: Public Standalone
export default function ProfilePage() {
  return (
    <PublicStandaloneProfile 
      data={individualProfile}
      isLoggedIn={false}
    />
  );
}
```

---

## 4. Individual Component Usage

### Social Icons

```tsx
<SocialIconsRow 
  links={[
    { platform: 'x', url: 'https://x.com/username' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/username' },
    { platform: 'telegram', url: 'https://t.me/username' },
    { platform: 'discord', url: 'https://discord.gg/server' },
    { platform: 'youtube', url: 'https://youtube.com/@channel' },
    { platform: 'github', url: 'https://github.com/username' },
    { platform: 'website', url: 'https://example.com' },
  ]} 
/>
```

### Token Price Card

```tsx
<TokenPriceCard 
  token={{
    ticker: 'MATRIX',
    name: 'MatrixPay Token',
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'Ethereum',
    price: '2.34',
    change24h: 5.67,
    marketCap: '42.5M',
    volume24h: '8.9M',
    links: {
      coinmarketcap: 'https://coinmarketcap.com/currencies/matrixpay',
      coingecko: 'https://coingecko.com/en/coins/matrixpay',
      dexscreener: 'https://dexscreener.com/ethereum/0x1234567890abcdef',
    },
  }}
/>
```

### Founder Card (with Video)

```tsx
<FounderCard 
  founder={{
    name: 'Sarah Chen',
    role: 'CTO & Co-Founder',
    handle: 'sarahchen',
    ethos: 892,
    xscore: 654,
    socialPower: 712,
    verified: true,
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoCaption: 'Sarah explains our vision for creator payments',
  }}
/>
```

### Founder Card (without Video)

```tsx
<FounderCard 
  founder={{
    name: 'Alex Kim',
    role: 'Lead Designer',
    handle: 'alexkim',
    ethos: 743,
    xscore: 821,
    socialPower: 789,
    verified: true,
  }}
/>
```

### Verification Badges

```tsx
{/* Verified - Green */}
<VerificationBadge state="verified" />
<VerificationBadge state="verified" label="Verified Deal" />

{/* Pending - Yellow */}
<VerificationBadge state="pending" />

{/* Requested - Blue */}
<VerificationBadge state="requested" />

{/* Community - Gray */}
<VerificationBadge state="community" />

{/* Small size */}
<VerificationBadge state="verified" size="sm" />
```

---

## 5. Conditional Rendering Based on Entity Type

```tsx
// Show founders only for projects/companies/brands
{(data.type === 'project' || data.type === 'company' || data.type === 'brand') && 
  data.founders && data.founders.length > 0 && (
  <div className="mb-8">
    <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
      Founders & Team
    </h2>
    <div className="grid gap-4 sm:grid-cols-2">
      {data.founders.map((founder, idx) => (
        <FounderCard key={idx} founder={founder} />
      ))}
    </div>
  </div>
)}

// Show token only for projects/companies with token
{(data.type === 'project' || data.type === 'company') && data.token && (
  <div className="mb-8">
    <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
      Token
    </h2>
    <TokenPriceCard token={data.token} />
  </div>
)}
```

---

## 6. MODE B: Dashboard Management View

### ProfilePage Component (from App.tsx line 1776+)

```tsx
function ProfilePage({ setRoute }) {
  const u = demo.me;
  
  return (
    <div className="space-y-6">
      <SectionTitle
        title={`linkary.xyz/${u.handle}`}
        subtitle="Public profile — This is how others see you"
        right={
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 stroke-[1.75]" /> Share
            </Button>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Connect
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT CARD - 1/3 width */}
        <Card className="lg:col-span-1">
          {/* Avatar & Name */}
          <div className="flex items-start gap-3 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-400" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold truncate" style={{ color: '#000000' }}>
                  {u.name}
                </span>
                {u.verified && <BadgeCheck className="h-5 w-5 text-emerald-400 stroke-[1.75]" />}
              </div>
              <p className="text-sm truncate" style={{ color: '#404040' }}>
                @{u.handle} · {u.location}
              </p>
            </div>
          </div>

          {/* Score Pills */}
          <ScorePills 
            ethos={u.ethos} 
            xscore={u.xscore} 
            reputationIndex={u.reputationIndex}
            socialPower={u.socialPower}
          />

          {/* Rating & Volume */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stars value={u.reviews.avg} />
              <span className="text-xs" style={{ color: '#404040' }}>
                {u.reviews.avg} ({u.reviews.count})
              </span>
            </div>
            <div className="text-xs" style={{ color: '#404040' }}>
              {formatMoneyEUR(u.volume.current)} volume
            </div>
          </div>

          {/* Bio, Roles, Links, etc. */}
          {/* ... rest of profile card ... */}
        </Card>

        {/* RIGHT CONTENT AREA - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Featured Work */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold" style={{ color: '#000000' }}>
                Featured Work
              </h3>
              <Button variant="outline" size="sm">Add</Button>
            </div>
            {/* ... featured work grid ... */}
          </Card>

          {/* Upcoming Events, Case Studies, Reviews */}
          {/* ... more cards ... */}
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Routing Logic

### In App.tsx

```tsx
// Import both components
import ProfilePage from './components/ProfilePage';  // MODE B
import PublicStandalonePage from './components/PublicStandalonePage';  // MODE A

// Route definitions
{route.name === "profile" && <ProfilePage setRoute={setRoute} />}
{route.name === "publicCreator" && <PublicStandalonePage profileType="individual" />}
{route.name === "publicProject" && <PublicStandalonePage profileType="project" />}
```

### Hide Sidebar for Public Profiles

```tsx
{/* Hide sidebar for public profile pages */}
{![\"publicCreator\", \"publicProject\", \"publicCompany\"].includes(route.name) && (
  <Sidebar route={route} setRoute={setRoute} />
)}
```

### Hide Topbar for Public Profiles

```tsx
{/* Hide topbar for public profile pages */}
{![\"publicCreator\", \"publicProject\", \"publicCompany\"].includes(route.name) && (
  <Topbar setMobileOpen={setMobileOpen} route={route} setRoute={setRoute} />
)}
```

---

## 8. TypeScript Interfaces

### PublicProfileData

```typescript
export interface PublicProfileData {
  type: 'individual' | 'project' | 'company' | 'brand' | 'agency';
  slug: string;
  name: string;
  handle?: string;
  tagline?: string;
  bio?: string;
  location?: string;
  verified?: boolean;
  
  ethos?: number;
  xscore?: number;
  reputationIndex?: number;
  socialPower?: number;
  
  reviews?: {
    avg: number;
    count: number;
  };
  
  socialLinks?: SocialLink[];
  links?: Array<{
    label: string;
    url: string;
    clicks?: number;
  }>;
  
  founders?: FounderData[];
  token?: TokenData;
  
  partnerships?: Array<{
    name: string;
    type: string;
    verified: boolean;
  }>;
  
  ambassadorOf?: string[];
  
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
    results: {
      metric: string;
      value: string;
    };
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

### SocialLink

```typescript
export interface SocialLink {
  platform: 'x' | 'telegram' | 'discord' | 'youtube' | 'website' | 'github' | 'linkedin';
  url: string;
}
```

### TokenData

```typescript
export interface TokenData {
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

### FounderData

```typescript
export interface FounderData {
  name: string;
  role: string;
  handle?: string;
  ethos?: number;
  xscore?: number;
  socialPower?: number;
  verified?: boolean;
  videoUrl?: string;
  videoCaption?: string;
}
```

---

## 9. Styling Utilities

### Color Palette (WCAG AA Compliant)

```css
/* In your styles or inline */
--bg-primary: #FFFFFF;
--bg-secondary: #F6F7F9;
--bg-dark: #0F1115;

--text-primary: #0F172A;
--text-secondary: #334155;
--text-muted: #64748B;
--text-on-dark: #FFFFFF;

--border-default: #E2E8F0;  /* zinc-200 */
--border-hover: #CBD5E1;    /* zinc-300 */
```

### Common Classes

```tsx
// Headers
<h1 style={{ color: '#0F172A' }}>Title</h1>
<h2 style={{ color: '#0F172A' }}>Subtitle</h2>

// Body text
<p style={{ color: '#334155' }}>Body text</p>

// Muted text
<span style={{ color: '#64748B' }}>Muted text</span>

// Cards
<Card className="p-4 border border-zinc-200">

// Buttons
<Button variant="outline" size="sm">
```

---

## 10. Responsive Grid

```tsx
{/* 2-column grid on desktop, 1-column on mobile */}
<div className="grid gap-4 sm:grid-cols-2">
  <FounderCard founder={founder1} />
  <FounderCard founder={founder2} />
</div>

{/* 3-column dashboard layout */}
<div className="grid gap-6 lg:grid-cols-3">
  <Card className="lg:col-span-1">Left sidebar</Card>
  <div className="lg:col-span-2">Right content</div>
</div>
```

---

## Quick Start Checklist

1. ✅ Copy component files to `/src/app/components/profile/`
2. ✅ Import components in your page
3. ✅ Define profile data using `PublicProfileData` interface
4. ✅ Render `<PublicStandaloneProfile data={data} />` for public view
5. ✅ Use existing `<ProfilePage />` for management view
6. ✅ Add routing logic to switch between modes
7. ✅ Hide sidebar/topbar for public profiles
8. ✅ Test on mobile and desktop

---

**Files to create:**
- `/src/app/components/profile/SocialIconsRow.tsx` ✅
- `/src/app/components/profile/TokenPriceCard.tsx` ✅
- `/src/app/components/profile/FounderCard.tsx` ✅
- `/src/app/components/profile/VerificationBadge.tsx` ✅
- `/src/app/components/profile/PublicStandaloneProfile.tsx` ✅
- `/src/app/components/PublicStandalonePage.tsx` ✅
- `/src/app/components/ui/stars.tsx` ✅

**All files already created and ready to use!** 🎉
