# 🎯 Unified Profile System Guide

**One layout, all profile types — just swap the data!**

---

## ✅ What This Is

**A single, professional profile layout** that works for:
- ✅ Creator Profiles (`/:username`)
- ✅ Brand Profiles (`/b/:slug`)
- ✅ Project Profiles (`/p/:slug`)
- ✅ Company/Agency Profiles
- ✅ Service Provider Profiles

**Benefits:**
- 🎨 **Consistent UI** across all profile types
- 🔧 **Single component to maintain**
- 📊 **Professional analytics cards** (replaces flip cards)
- ♿ **High contrast typography** (WCAG AAA)
- 🚀 **Easy to extend** with custom sections

---

## 📦 Component Location

```
/src/app/components/UnifiedProfileLayout.tsx
```

---

## 🚀 Quick Start

### 1. Import the Component

```tsx
import UnifiedProfileLayout from "./components/UnifiedProfileLayout";
import type { UnifiedProfileData } from "./components/UnifiedProfileLayout";
```

### 2. Prepare Your Data

```tsx
const profileData: UnifiedProfileData = {
  slug: "username",
  name: "Profile Name",
  entityType: "creator", // or "brand", "project", "company", "agency"
  verified: true,
  bio: "Your bio text...",
  links: [],
  // ... other fields
};
```

### 3. Render the Profile

```tsx
<UnifiedProfileLayout data={profileData} />
```

**That's it!** 🎉

---

## 📊 Data Structure

### Core Fields (Required)

```typescript
{
  slug: string;              // URL slug (username or identifier)
  name: string;              // Display name
  entityType: EntityType;    // "creator" | "project" | "company" | "brand" | "agency"
  verified: boolean;         // Verification badge
  bio: string;               // Bio/description
  links: Link[];            // Array of quick links
}
```

### Optional Fields

```typescript
{
  // Visual assets
  avatar?: string;           // Profile avatar URL
  logo?: string;             // Logo URL (for brands/projects)
  headerImage?: string;      // Banner/cover image
  introVideo?: string;       // Video or media URL
  introVideoType?: 'iframe' | 'video' | 'image';
  
  // Reputation scores
  influenceScore?: number;   // Overall influence
  ethosScore?: number;       // ETHOS verification score
  xScore?: number;           // Network activity score
  
  // Social links
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  github?: string;
  linkedin?: string;
  medium?: string;
  email?: string;
  instagram?: string;
  youtube?: string;
  warpcast?: string;
  
  // Additional data
  followers?: number;
  projects?: Project[];
  team?: TeamMember[];
  partners?: Partner[];
  subsidiaries?: UnifiedProfileData[];
  
  // Custom sections (flexible!)
  customSections?: Array<{
    title: string;
    content: React.ReactNode;
  }>;
}
```

---

## 🎨 Examples for Each Profile Type

### 1. Creator Profile

```tsx
import UnifiedProfileLayout from "./components/UnifiedProfileLayout";
import { Github, Briefcase, FileText } from "lucide-react";

const creatorData = {
  slug: "alexchen",
  name: "Alex Chen",
  entityType: "creator" as const,
  verified: true,
  avatar: "https://example.com/avatar.jpg",
  headerImage: "https://example.com/banner.jpg",
  bio: "Full-stack developer specializing in Web3 protocols and decentralized applications.",
  
  // Reputation scores
  influenceScore: 892,
  ethosScore: 94,
  xScore: 87,
  
  // Social links
  website: "https://alexchen.dev",
  twitter: "https://twitter.com/alexchen",
  github: "https://github.com/alexchen",
  linkedin: "https://linkedin.com/in/alexchen",
  
  // Quick links
  links: [
    {
      id: "1",
      title: "Portfolio",
      url: "https://alexchen.dev",
      icon: Briefcase,
      description: "View my work and projects",
    },
    {
      id: "2",
      title: "GitHub",
      url: "https://github.com/alexchen",
      icon: Github,
      description: "Check out my open source contributions",
    },
    {
      id: "3",
      title: "Blog",
      url: "https://blog.alexchen.dev",
      icon: FileText,
      description: "Read my technical articles",
    },
  ],
  
  // Projects worked on
  projects: [
    {
      name: "DeFi Protocol",
      slug: "defi-protocol",
      role: "Lead Developer",
      verified: true,
      logo: "https://example.com/project-logo.png",
    },
  ],
};

export function CreatorProfilePage() {
  return <UnifiedProfileLayout data={creatorData} />;
}
```

---

### 2. Brand Profile

```tsx
import UnifiedProfileLayout from "./components/UnifiedProfileLayout";
import { ExternalLink, FileText, Users } from "lucide-react";

const brandData = {
  slug: "techcorp",
  name: "TechCorp",
  entityType: "brand" as const,
  verified: true,
  logo: "https://example.com/logo.png",
  headerImage: "https://example.com/brand-banner.jpg",
  bio: "Leading Web3 infrastructure provider building the future of decentralized applications.",
  
  // Reputation scores
  influenceScore: 1542,
  ethosScore: 98,
  xScore: 92,
  
  // Social links
  website: "https://techcorp.io",
  twitter: "https://twitter.com/techcorp",
  discord: "https://discord.gg/techcorp",
  telegram: "https://t.me/techcorp",
  github: "https://github.com/techcorp",
  
  // Quick links
  links: [
    {
      id: "1",
      title: "Documentation",
      url: "https://docs.techcorp.io",
      icon: FileText,
      description: "Developer documentation and guides",
    },
    {
      id: "2",
      title: "Careers",
      url: "https://techcorp.io/careers",
      icon: Users,
      description: "Join our team",
    },
    {
      id: "3",
      title: "Ecosystem",
      url: "https://ecosystem.techcorp.io",
      icon: ExternalLink,
      description: "Explore our projects",
    },
  ],
  
  // Team members
  team: [
    {
      name: "Sarah Johnson",
      role: "CEO & Co-founder",
      slug: "sarahjohnson",
      verified: true,
      avatar: "https://example.com/sarah.jpg",
    },
    {
      name: "Michael Lee",
      role: "CTO",
      slug: "michaellee",
      verified: true,
      avatar: "https://example.com/michael.jpg",
    },
  ],
  
  // Partners
  partners: [
    {
      name: "Partner A",
      logo: "https://example.com/partner-a.png",
      relationship: "Technology Partner",
      url: "https://partner-a.com",
    },
    {
      name: "Partner B",
      logo: "https://example.com/partner-b.png",
      relationship: "Investment Partner",
    },
  ],
};

export function BrandProfilePage() {
  return <UnifiedProfileLayout data={brandData} />;
}
```

---

### 3. Project Profile

```tsx
import UnifiedProfileLayout from "./components/UnifiedProfileLayout";
import { ExternalLink, FileText, Code } from "lucide-react";

const projectData = {
  slug: "defi-protocol",
  name: "DeFi Protocol",
  entityType: "project" as const,
  verified: true,
  logo: "https://example.com/project-logo.png",
  headerImage: "https://example.com/project-banner.jpg",
  bio: "Decentralized finance protocol enabling permissionless lending and borrowing.",
  
  // Reputation scores
  influenceScore: 2156,
  ethosScore: 96,
  xScore: 89,
  
  // Social links
  website: "https://defiprotocol.io",
  twitter: "https://twitter.com/defiprotocol",
  discord: "https://discord.gg/defiprotocol",
  github: "https://github.com/defi-protocol",
  
  // Intro video
  introVideo: "https://www.youtube.com/embed/VIDEO_ID",
  introVideoType: "iframe",
  
  // Quick links with token preview
  links: [
    {
      id: "1",
      title: "$TOKEN - Trade Now",
      url: "https://dex.example.com/token",
      icon: ExternalLink,
      description: "Trade on decentralized exchanges",
      preview: {
        type: "token",
        data: {
          symbol: "TOKEN",
          price: "$1.42",
          change24h: 12.5,
          marketCap: "$142M",
        },
      },
    },
    {
      id: "2",
      title: "Documentation",
      url: "https://docs.defiprotocol.io",
      icon: FileText,
      description: "Integration guides and API reference",
    },
    {
      id: "3",
      title: "GitHub",
      url: "https://github.com/defi-protocol",
      icon: Code,
      description: "Open source smart contracts",
    },
  ],
  
  // Team
  team: [
    {
      name: "Protocol Team",
      role: "Core Contributors",
      slug: "defi-protocol-team",
      verified: true,
    },
  ],
};

export function ProjectProfilePage() {
  return <UnifiedProfileLayout data={projectData} />;
}
```

---

### 4. Company Profile

```tsx
import UnifiedProfileLayout from "./components/UnifiedProfileLayout";
import { Building2, Users, Briefcase } from "lucide-react";

const companyData = {
  slug: "web3-ventures",
  name: "Web3 Ventures",
  entityType: "company" as const,
  verified: true,
  logo: "https://example.com/company-logo.png",
  headerImage: "https://example.com/company-banner.jpg",
  bio: "Venture capital firm investing in Web3 infrastructure and decentralized technologies.",
  
  // Reputation scores
  influenceScore: 3421,
  ethosScore: 99,
  xScore: 95,
  
  // Social links
  website: "https://web3ventures.io",
  twitter: "https://twitter.com/web3ventures",
  linkedin: "https://linkedin.com/company/web3ventures",
  
  // Quick links
  links: [
    {
      id: "1",
      title: "Portfolio",
      url: "https://web3ventures.io/portfolio",
      icon: Briefcase,
      description: "View our portfolio companies",
    },
    {
      id: "2",
      title: "Apply",
      url: "https://web3ventures.io/apply",
      icon: Building2,
      description: "Apply for funding",
    },
    {
      id: "3",
      title: "Team",
      url: "https://web3ventures.io/team",
      icon: Users,
      description: "Meet our team",
    },
  ],
  
  // Subsidiaries (child companies)
  subsidiaries: [
    {
      slug: "subsidiary-a",
      name: "Subsidiary A",
      entityType: "project",
      verified: true,
      bio: "Web3 infrastructure provider",
      links: [],
      logo: "https://example.com/sub-a.png",
    },
  ],
};

export function CompanyProfilePage() {
  return <UnifiedProfileLayout data={companyData} />;
}
```

---

## 🎨 Using Custom Sections

Add any custom content with the `customSections` field:

```tsx
const profileData = {
  // ... other fields
  
  customSections: [
    {
      title: "About Us",
      content: (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-base text-slate-700 leading-relaxed">
            Custom content goes here. You can use any React components!
          </p>
        </div>
      ),
    },
    {
      title: "Achievements",
      content: (
        <AnalyticsGrid columns={3}>
          <AnalyticsCard value="10M+" label="Users" icon={Users} />
          <AnalyticsCard value="$500M" label="TVL" icon={TrendingUp} />
          <AnalyticsCard value="98%" label="Uptime" icon={Activity} />
        </AnalyticsGrid>
      ),
    },
  ],
};
```

---

## 🔄 Migration from Old Profile Pages

### Before (Separate Components)

```tsx
// BrandProfilePage.tsx - Custom layout
// UserProfilePage.tsx - Different layout
// ProjectProfilePage.tsx - Another layout
```

### After (Unified)

```tsx
// All use UnifiedProfileLayout
import UnifiedProfileLayout from "./components/UnifiedProfileLayout";

export function BrandProfilePage() {
  const brandData = { /* ... */ };
  return <UnifiedProfileLayout data={brandData} />;
}

export function UserProfilePage() {
  const userData = { /* ... */ };
  return <UnifiedProfileLayout data={userData} />;
}

export function ProjectProfilePage() {
  const projectData = { /* ... */ };
  return <UnifiedProfileLayout data={projectData} />;
}
```

**Same layout, just different data!** ✅

---

## 📊 Professional Analytics Cards

The unified layout uses the new `AnalyticsCard` component:

```tsx
// Old (gimmicky flip cards)
<FlipCard
  front={<div>892</div>}
  back={<div>Details...</div>}
/>

// New (professional analytics)
<AnalyticsCard
  value="892"
  label="ETHOS Score"
  subtitle="Identity & verification"
  icon={Shield}
  size="md"
/>
```

**Benefits:**
- ✅ No flipping animations
- ✅ High contrast (WCAG AAA)
- ✅ Clear hierarchy
- ✅ Professional appearance

---

## 🎨 Design Features

### High Contrast Typography
- **Primary text:** `text-slate-900` (15:1 contrast)
- **Secondary text:** `text-slate-700` (9:1 contrast)
- **Muted text:** `text-slate-600` (7:1 contrast)

### Clean Backgrounds
- **Main bg:** `#F7F8FB` (light gray)
- **Cards:** `GlassCard` with subtle borders
- **No gradient overlays on text**

### Professional Components
- **Analytics cards** instead of flip cards
- **Clean social icons** with hover states
- **Smooth animations** (subtle, not gimmicky)

---

## 🔧 Customization

### Changing Colors

Edit the gradient colors in the component:

```tsx
// Avatar gradient
bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500

// Primary button
bg-gradient-to-r from-indigo-600 to-purple-600
```

### Adding New Sections

Use `customSections`:

```tsx
customSections: [
  {
    title: "Your Custom Section",
    content: <YourCustomComponent />,
  },
]
```

### Custom Entity Types

Add new entity types to the `EntityType`:

```typescript
export type EntityType = "creator" | "project" | "company" | "brand" | "agency" | "dao";
```

Then add the icon in the component:

```tsx
{data.entityType === "dao" && <Users className="w-4 h-4" />}
```

---

## ✅ Benefits Summary

| Feature | Before | After |
|---------|--------|-------|
| **Layouts** | 3+ separate layouts | 1 unified layout |
| **Maintenance** | Update each file | Update once |
| **Consistency** | Different UIs | Same UI everywhere |
| **Analytics** | Flip cards (gimmicky) | Professional cards |
| **Contrast** | Low (WCAG fail) | High (WCAG AAA) |
| **Extensibility** | Hard to extend | Easy with customSections |

---

## 🚀 Next Steps

1. **Replace existing profile pages** with `UnifiedProfileLayout`
2. **Migrate your data** to the `UnifiedProfileData` format
3. **Test all profile types** with the new layout
4. **Customize** as needed with custom sections
5. **Deploy** and enjoy consistent, professional profiles!

---

## 📞 Need Help?

**Component location:** `/src/app/components/UnifiedProfileLayout.tsx`  
**Example usage:** See examples above for each profile type  
**Design tokens:** `/DESIGN_TOKENS.md`  
**Analytics cards:** `/src/app/components/AnalyticsCard.tsx`

---

**One layout. All profiles. Professional results.** 🎯
