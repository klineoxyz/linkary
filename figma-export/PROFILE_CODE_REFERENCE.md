# Profile System Code Reference

## Quick Overview

Linkary implements **two distinct profile experiences** that share the same data but present it differently:

---

## MODE A: Public Standalone Profile
**Link3-style standalone page - No sidebar, clean and shareable**

### Component Location
`/src/app/components/profile/PublicStandaloneProfile.tsx`

### Demo Page
`/src/app/components/PublicStandalonePage.tsx`

### Routes in App.tsx
```typescript
{route.name === "publicCreator" && <PublicStandalonePage profileType="individual" />}
{route.name === "publicProject" && <PublicStandalonePage profileType="project" />}
```

### Key Features
```tsx
// Minimal Header (sticky)
<header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95">
  - Linkary logo
  - Copy Link button
  - Share button
  - Login button (if not logged in)
</header>

// Hero Section
<div className="mb-8 text-center">
  - Large avatar (24x24, rounded-2xl)
  - Name (H1) + verification badge
  - Entity type pill + handle + location
  - Tagline or bio (max-w-2xl)
  - Reputation score pills (ETHOS, XScore, Rep Index, Social)
  - Reviews rating
  - Primary CTAs (Connect, Contact, Website)
</div>

// Social Icons Row
<SocialIconsRow links={socialLinks} />
// Clean monochrome icons with hover states

// Link Builder Section
{links.map(link => (
  <a className="rounded-lg border p-4">
    - Icon + label
    - Click count
  </a>
))}

// Founders/Team (Projects/Companies only)
<div className="grid gap-4 sm:grid-cols-2">
  {founders.map(founder => (
    <FounderCard founder={founder} />
    // Includes video embed slot
  ))}
</div>

// Token Section (Projects with tokens)
{token && <TokenPriceCard token={token} />}

// Partnerships, Ambassador Of, Featured Work, Case Studies, Reviews
// All displayed in clean card layout with verification badges

// Footer
<footer className="border-t border-zinc-200 py-8">
  Powered by Linkary · Web3 Reputation Infrastructure
</footer>
```

### Structure
```
min-h-screen bg-white
  └─ sticky header
  └─ main (max-w-3xl mx-auto px-4 py-8)
      ├─ Hero
      ├─ Social Icons
      ├─ Link Cards
      ├─ Founders (with video)
      ├─ Token Card
      ├─ Partnerships
      ├─ Featured Work
      ├─ Case Studies
      └─ Reviews
  └─ footer
```

---

## MODE B: Logged-In Management View
**Dashboard-style 3-column layout with edit controls**

### Component Location
`/src/app/App.tsx` → `ProfilePage` function (line 1776+)

### Routes in App.tsx
```typescript
{route.name === "profile" && <ProfilePage setRoute={setRoute} />}
```

### Key Features
```tsx
// Top Section Title Bar
<SectionTitle
  title={`linkary.xyz/${handle}`}
  subtitle="Public profile — This is how others see you"
  right={
    <div className="flex gap-3">
      <Button variant="outline">
        <ExternalLink /> Share
      </Button>
      <Button>
        <UserPlus /> Connect
      </Button>
    </div>
  }
/>

// 3-Column Grid Layout
<div className="grid gap-6 lg:grid-cols-3">
  {/* LEFT CARD - 1/3 width */}
  <Card className="lg:col-span-1">
    - Avatar + name + verified badge
    - Handle + location
    - Score pills (ETHOS, XScore, Rep Index, Social)
    - Rating + volume
    - Bio
    - Role tags (with gradient badges)
    - Ambassador of (with gradient badges)
    - Partnerships (with image overlay + gradient)
    - Links (with gradient cards + click counts)
  </Card>

  {/* RIGHT CONTENT - 2/3 width */}
  <div className="lg:col-span-2 space-y-6">
    <Card> {/* Featured Work */}
      - Title + "Add" button
      - 2-column grid
      - Gradient cards with view counts
    </Card>

    <Card> {/* Upcoming Events */}
      - Title + "View All" button
      - Event cards with type pills
      - Gradient backgrounds
    </Card>

    <Card> {/* Case Studies */}
      - Title + "Add New" button
      - Project cards with results metrics
      - Testimonials
    </Card>

    <Card> {/* Reviews */}
      - Title + "Leave Review" button
      - Review cards with ratings
      - Verified deal badges
      - Tag pills
    </Card>
  </div>
</div>
```

### Structure
```
space-y-6
  └─ SectionTitle (with Share/Connect buttons)
  └─ grid gap-6 lg:grid-cols-3
      ├─ Card (lg:col-span-1) - Left Profile Card
      │   ├─ Avatar + Name + Verified
      │   ├─ Score Pills
      │   ├─ Rating + Volume
      │   ├─ Bio
      │   ├─ Role Tags
      │   ├─ Ambassador Of
      │   ├─ Partnerships (image overlay cards)
      │   └─ Links
      │
      └─ div (lg:col-span-2) - Right Content Area
          ├─ Featured Work Card
          ├─ Upcoming Events Card
          ├─ Case Studies Card
          └─ Reviews Card
```

---

## Visual Comparison

### MODE A: Public Standalone
```
┌─────────────────────────────────────┐
│ Linkary    [Copy Link] [Share] [⚙] │ ← Minimal header
├─────────────────────────────────────┤
│                                     │
│         ┌────┐                      │
│         │ 👤 │  Muaz Xinthi ✓       │ ← Hero
│         └────┘                      │
│         Individual · @muazxinthi    │
│         Creator economy operator... │
│                                     │
│    [ETHOS 842] [XScore 771] ...     │ ← Scores
│         ⭐⭐⭐⭐⭐ 4.8 (37)            │
│                                     │
│    [Connect] [Contact] [Website]    │ ← CTAs
│                                     │
│  [X] [LinkedIn] [Telegram] [Web]    │ ← Social icons
│                                     │
│ ┌──────────────────────────────┐   │
│ │ 🔗 Portfolio      412 clicks │   │
│ └──────────────────────────────┘   │ ← Link cards
│ ┌──────────────────────────────┐   │
│ │ 🔗 Case Studies   324 clicks │   │
│ └──────────────────────────────┘   │
│                                     │
│ Founders & Team                     │
│ ┌────────────┐ ┌────────────┐      │
│ │ [Video]    │ │ [Photo]    │      │ ← Founder cards
│ │ Sarah Chen │ │ Alex Kim   │      │
│ └────────────┘ └────────────┘      │
│                                     │
│ Token                               │
│ ┌────────────────────────────────┐ │
│ │ MatrixPay Token                │ │
│ │ $MATRIX · Ethereum             │ │ ← Token card
│ │ $2.34  +5.67% ↗                │ │
│ │ [CMC] [CoinGecko] [Dexscreener]│ │
│ └────────────────────────────────┘ │
│                                     │
│ Case Studies, Reviews, etc...       │
│                                     │
└─────────────────────────────────────┘
│ Powered by Linkary                  │ ← Footer
└─────────────────────────────────────┘
```

### MODE B: Logged-In Management
```
[Sidebar] ┌────────────────────────────────────────┐
[Nav]     │ linkary.xyz/muazxinthi      [Share] [Connect] │ ← SectionTitle
[Menu]    ├────────────────────────────────────────┤
          │                                        │
          │ ┌──────────┐  ┌─────────────────────┐│
          │ │  Avatar  │  │ Featured Work       ││
          │ │  👤      │  │ ┌─────┐ ┌─────┐    ││
          │ │          │  │ │Work1│ │Work2│    ││
          │ │ Muaz ✓   │  │ └─────┘ └─────┘    ││
          │ │ @muazx.. │  └─────────────────────┘│
          │ │          │  ┌─────────────────────┐│
          │ │ ETHOS    │  │ Upcoming Events     ││
          │ │ XScore   │  │ • X Space - Feb 12  ││
          │ │ Rep      │  │ • Podcast - Feb 13  ││
          │ │ Social   │  └─────────────────────┘│
          │ │          │  ┌─────────────────────┐│
          │ │ ⭐ 4.8   │  │ Case Studies        ││
          │ │          │  │ MatrixPay ✓         ││
          │ │ Bio...   │  │ [Results: +340%]    ││
          │ │          │  └─────────────────────┘│
          │ │ Roles    │  ┌─────────────────────┐│
          │ │ Founder  │  │ Reviews             ││
          │ │ Creator  │  │ MatrixPay ⭐⭐⭐⭐⭐   ││
          │ │          │  │ "Fast delivery..."  ││
          │ │ Partners │  └─────────────────────┘│
          │ │ Chainlnk │                         │
          │ │ Polygon  │                         │
          │ │          │                         │
          │ │ Links    │                         │
          │ │ X: 3.4K  │                         │
          │ │ LinkedIn │                         │
          │ └──────────┘                         │
          │     1/3          2/3                 │
          └────────────────────────────────────────┘
```

---

## Core Components

### SocialIconsRow
```tsx
// /src/app/components/profile/SocialIconsRow.tsx
<SocialIconsRow 
  links={[
    { platform: 'x', url: 'https://x.com/...' },
    { platform: 'linkedin', url: 'https://linkedin.com/...' },
    { platform: 'telegram', url: 'https://t.me/...' },
  ]} 
/>
```

### TokenPriceCard
```tsx
// /src/app/components/profile/TokenPriceCard.tsx
<TokenPriceCard 
  token={{
    ticker: 'MATRIX',
    name: 'MatrixPay Token',
    contractAddress: '0x1234...',
    chain: 'Ethereum',
    price: '2.34',
    change24h: 5.67,
    marketCap: '42.5M',
    volume24h: '8.9M',
    links: {
      coinmarketcap: 'https://...',
      coingecko: 'https://...',
      dexscreener: 'https://...',
    }
  }}
/>
```

### FounderCard
```tsx
// /src/app/components/profile/FounderCard.tsx
<FounderCard 
  founder={{
    name: 'Sarah Chen',
    role: 'CTO & Co-Founder',
    handle: 'sarahchen',
    ethos: 892,
    xscore: 654,
    socialPower: 712,
    verified: true,
    videoUrl: 'https://www.youtube.com/embed/...',
    videoCaption: 'Sarah explains our vision',
  }}
/>
```

### VerificationBadge
```tsx
// /src/app/components/profile/VerificationBadge.tsx
<VerificationBadge state="verified" label="Verified Deal" />
<VerificationBadge state="pending" />
<VerificationBadge state="requested" />
<VerificationBadge state="community" />
```

---

## Data Flow

```
demo.me (individual)
  ↓
PublicProfileData interface
  ↓
┌─────────────────┬──────────────────┐
│                 │                  │
MODE A            MODE B
PublicStandalone  ProfilePage
(Link3-style)     (Dashboard-style)
│                 │
└─────────────────┴──────────────────┘
     Same data, different presentation
```

---

## Styling Philosophy

### MODE A (Public)
- White background (`#FFFFFF`)
- Clean borders (`border-zinc-200`)
- Subtle hover states
- Focus on readability
- Mobile-first responsive
- **No gradients on text backgrounds**
- **High contrast text** (`#0F172A`, `#334155`, `#64748B`)

### MODE B (Dashboard)
- Premium gradient cards
- Colorful badges with gradients
- Image overlays with gradients
- Data-rich visualization
- Desktop-optimized
- **Gradients allowed** (no text overlap issues)
- **Same high contrast text**

---

## When to Use Which Mode

### Use MODE A (Public Standalone) when:
✅ User is not logged in
✅ Sharing profile on social media
✅ Embedding in external websites
✅ Public portfolio/link page
✅ SEO-optimized landing page
✅ Mobile-first experience

### Use MODE B (Dashboard Management) when:
✅ User is logged in and owns the profile
✅ User has edit permissions
✅ Viewing detailed analytics
✅ Managing content and settings
✅ Comprehensive data overview
✅ Desktop workflow

---

## Migration Path

**From existing ProfilePage → New system:**

1. Keep old ProfilePage as-is (gradient design)
2. Add new PublicStandaloneProfile for public view
3. Route logic determines which to show:
   ```tsx
   const isOwner = currentUser?.id === profileUser.id;
   const isLoggedIn = !!currentUser;
   
   if (!isLoggedIn || !isOwner) {
     return <PublicStandaloneProfile data={data} />;
   }
   
   return <ProfilePage data={data} />;
   ```

---

## Accessibility Compliance

Both modes follow WCAG AA standards:

✅ 4.5:1 contrast ratio for body text
✅ 3:1 contrast ratio for large text and UI components
✅ Semantic HTML structure (h1, h2, sections)
✅ Proper ARIA labels on interactive elements
✅ Keyboard navigation support
✅ Screen reader friendly
✅ Focus visible states

---

## Performance Considerations

**MODE A (Public):**
- Optimized for fast load times
- Minimal JavaScript
- Static content prioritized
- Good for SEO crawlers

**MODE B (Dashboard):**
- Rich interactivity
- Real-time updates
- Advanced data visualization
- Desktop-optimized bundle

---

## Summary

| Feature | MODE A (Public) | MODE B (Dashboard) |
|---------|----------------|-------------------|
| Layout | Single column | 3-column grid |
| Navigation | Minimal header | Full sidebar |
| Edit Controls | ❌ None | ✅ Inline controls |
| Gradients | Minimal | Premium |
| Video Embeds | ✅ Founders | ❌ Not applicable |
| Token Card | ✅ Projects | ❌ Not shown |
| Social Icons | ✅ Clean row | ❌ Link list |
| Audience | Public viewers | Profile owners |
| Goal | Credibility & sharing | Management & editing |

**Both modes are production-ready and fully responsive.**
