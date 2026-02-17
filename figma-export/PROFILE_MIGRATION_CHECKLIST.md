# ✅ Profile Migration Checklist

**Convert existing profile pages to use UnifiedProfileLayout**

---

## 🎯 Goal

Replace **3+ different profile layouts** with **1 unified layout** that:
- ✅ Uses professional analytics cards (no flips)
- ✅ Has high contrast typography (WCAG AAA)
- ✅ Works for ALL profile types
- ✅ Is easier to maintain

---

## 📋 Migration Steps

### Phase 1: Preparation (15 minutes)

- [ ] **Read the guide**
  - `/UNIFIED_PROFILE_GUIDE.md` - Usage examples
  - `/DESIGN_TOKENS.md` - Design system
  - Component: `/src/app/components/UnifiedProfileLayout.tsx`

- [ ] **Import typography system**
  ```tsx
  // In your main App.tsx or layout
  import "../styles/typography.css";
  ```

- [ ] **Test the component**
  - Create a test profile with sample data
  - Verify it renders correctly
  - Check responsive design

---

### Phase 2: Data Migration (30 minutes per page)

#### Step 1: BrandProfilePage.tsx

- [ ] **Backup the file**
  ```bash
  cp src/app/components/BrandProfilePage.tsx src/app/components/BrandProfilePage.tsx.backup
  ```

- [ ] **Extract brand data**
  - Find all the profile data in the current file
  - Map it to `UnifiedProfileData` format
  - Note: Use `entityType: "brand"`

- [ ] **Replace the component**
  ```tsx
  import UnifiedProfileLayout from "./UnifiedProfileLayout";
  import type { UnifiedProfileData } from "./UnifiedProfileLayout";
  
  const brandData: UnifiedProfileData = {
    slug: "brand-slug",
    name: "Brand Name",
    entityType: "brand",
    verified: true,
    // ... rest of data
  };
  
  export default function BrandProfilePage() {
    return <UnifiedProfileLayout data={brandData} />;
  }
  ```

- [ ] **Test thoroughly**
  - All text is readable? ✓
  - Analytics cards display? ✓
  - Social links work? ✓
  - Responsive design? ✓

---

#### Step 2: UserProfilePage.tsx (Creator Profiles)

- [ ] **Backup the file**
  ```bash
  cp src/app/components/UserProfilePage.tsx src/app/components/UserProfilePage.tsx.backup
  ```

- [ ] **Extract user data**
  - Map to `UnifiedProfileData`
  - Use `entityType: "creator"`

- [ ] **Replace the component**
  ```tsx
  import UnifiedProfileLayout from "./UnifiedProfileLayout";
  
  const userData: UnifiedProfileData = {
    slug: "username",
    name: "User Name",
    entityType: "creator",
    // ... rest of data
  };
  
  export default function UserProfilePage() {
    return <UnifiedProfileLayout data={userData} />;
  }
  ```

- [ ] **Test thoroughly**

---

#### Step 3: ProjectProfilePage.tsx

- [ ] **Backup the file**
  ```bash
  cp src/app/components/ProjectProfilePage.tsx src/app/components/ProjectProfilePage.tsx.backup
  ```

- [ ] **Extract project data**
  - Map to `UnifiedProfileData`
  - Use `entityType: "project"`

- [ ] **Replace the component**
  ```tsx
  import UnifiedProfileLayout from "./UnifiedProfileLayout";
  
  const projectData: UnifiedProfileData = {
    slug: "project-slug",
    name: "Project Name",
    entityType: "project",
    // ... rest of data
  };
  
  export default function ProjectProfilePage() {
    return <UnifiedProfileLayout data={projectData} />;
  }
  ```

- [ ] **Test thoroughly**

---

### Phase 3: Data Structure Updates (1 hour)

#### Map Old Data to New Format

**Old structure (example):**
```tsx
// Old: Mixed structure
interface OldProfile {
  username: string;
  displayName: string;
  profilePic: string;
  coverPhoto: string;
  description: string;
  // ... scattered fields
}
```

**New structure:**
```tsx
// New: Unified structure
const newProfile: UnifiedProfileData = {
  slug: oldProfile.username,
  name: oldProfile.displayName,
  avatar: oldProfile.profilePic,
  headerImage: oldProfile.coverPhoto,
  bio: oldProfile.description,
  entityType: "creator",
  verified: oldProfile.isVerified || false,
  links: [], // Map old links
  // ... rest
};
```

#### Conversion Helper

Create a conversion function:

```tsx
function convertToUnifiedProfile(oldData: any, type: EntityType): UnifiedProfileData {
  return {
    slug: oldData.slug || oldData.username,
    name: oldData.name || oldData.displayName,
    entityType: type,
    verified: oldData.verified || oldData.isVerified || false,
    avatar: oldData.avatar || oldData.profilePic,
    logo: oldData.logo,
    headerImage: oldData.headerImage || oldData.coverPhoto || oldData.banner,
    bio: oldData.bio || oldData.description || oldData.about,
    
    // Social links
    website: oldData.website,
    twitter: oldData.twitter || oldData.twitterUrl,
    discord: oldData.discord,
    telegram: oldData.telegram,
    github: oldData.github,
    linkedin: oldData.linkedin,
    
    // Reputation
    influenceScore: oldData.influenceScore || oldData.reputation,
    ethosScore: oldData.ethosScore,
    xScore: oldData.xScore || oldData.wallchainScore,
    
    // Links
    links: (oldData.links || []).map((link: any) => ({
      id: link.id || Math.random().toString(),
      title: link.title || link.name,
      url: link.url,
      icon: link.icon || ExternalLink,
      description: link.description,
    })),
    
    // Team, projects, partners
    team: oldData.team || oldData.teamMembers,
    projects: oldData.projects,
    partners: oldData.partners,
  };
}
```

---

### Phase 4: Remove Old Components (30 minutes)

After verifying everything works:

- [ ] **Delete flip card components**
  ```bash
  # Only if no longer needed
  rm src/app/components/FlipCard.tsx
  ```

- [ ] **Remove old profile-specific components**
  - Keep backups for reference
  - Remove imports from other files

- [ ] **Clean up unused code**
  - Old card components
  - Duplicate layouts
  - Unused imports

---

### Phase 5: Testing & Verification (1 hour)

#### Visual Testing

- [ ] **Load each profile type**
  - [ ] Creator profile
  - [ ] Brand profile
  - [ ] Project profile
  - [ ] Company profile

- [ ] **Check every section**
  - [ ] Header with banner ✓
  - [ ] Avatar/logo ✓
  - [ ] Name and verification badge ✓
  - [ ] Entity type badge ✓
  - [ ] Bio text (readable, high contrast) ✓
  - [ ] Social links (all working) ✓
  - [ ] Reputation scores (professional cards) ✓
  - [ ] Quick links section ✓
  - [ ] Team section (if applicable) ✓
  - [ ] Projects section (if applicable) ✓
  - [ ] Partners section (if applicable) ✓

#### Responsive Testing

- [ ] **Desktop (1920x1080)**
  - Layout looks good ✓
  - Text readable ✓
  - Cards display properly ✓

- [ ] **Tablet (768x1024)**
  - Cards stack correctly ✓
  - Text remains readable ✓
  - Buttons accessible ✓

- [ ] **Mobile (375x667)**
  - Everything stacks vertically ✓
  - Text still readable ✓
  - Social icons accessible ✓

#### Contrast Testing

- [ ] **Use browser DevTools**
  - Inspect text colors
  - Verify contrast ratios
  - All text meets WCAG AA minimum (4.5:1)

- [ ] **Primary text:** 15:1 or higher ✓
- [ ] **Secondary text:** 9:1 or higher ✓
- [ ] **Muted text:** 7:1 or higher ✓

#### Functionality Testing

- [ ] **Copy link button** works ✓
- [ ] **Share button** works (or falls back to copy) ✓
- [ ] **Social links** open correctly ✓
- [ ] **Quick links** navigate properly ✓
- [ ] **Website button** works ✓
- [ ] **Team/project cards** are clickable (if linked) ✓

---

### Phase 6: Documentation (15 minutes)

- [ ] **Update README**
  - Note the unified profile system
  - Link to guide

- [ ] **Document custom sections**
  - How to add new sections
  - Examples for your use case

- [ ] **Create component guide**
  - How developers should use it
  - Data format requirements

---

## 📊 Migration Tracking

| File | Status | Time Spent | Issues | Completed |
|------|--------|------------|--------|-----------|
| BrandProfilePage.tsx | ⬜ Not started | - | - | ❌ |
| UserProfilePage.tsx | ⬜ Not started | - | - | ❌ |
| ProjectProfilePage.tsx | ⬜ Not started | - | - | ❌ |
| AgencyProfilePage.tsx | ⬜ Not started | - | - | ❌ |
| Testing | ⬜ Not started | - | - | ❌ |

**Status options:**
- ⬜ Not started
- 🟡 In progress
- ✅ Complete

---

## 🚨 Common Issues & Solutions

### Issue 1: "Data doesn't match UnifiedProfileData"

**Solution:** Use the conversion helper function above.

```tsx
const unifiedData = convertToUnifiedProfile(oldData, "creator");
```

---

### Issue 2: "Custom sections not displaying"

**Solution:** Use `customSections` array:

```tsx
customSections: [
  {
    title: "Custom Section",
    content: <YourComponent />,
  },
]
```

---

### Issue 3: "Social icons not showing"

**Solution:** Ensure URLs are full paths:

```tsx
twitter: "https://twitter.com/username" // ✅ Good
twitter: "@username" // ❌ Bad
```

---

### Issue 4: "Reputation cards look different"

**Solution:** They should! The new cards are professional (no flips).

Old:
```tsx
<FlipCard front={...} back={...} />
```

New:
```tsx
<AnalyticsCard
  value="892"
  label="ETHOS Score"
  icon={Shield}
/>
```

---

### Issue 5: "Layout looks off on mobile"

**Solution:** Check that you're not overriding responsive classes.

The component handles responsive design automatically.

---

## ✅ Final Verification

Before considering migration complete:

### Code Quality
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All imports working
- [ ] No unused imports

### Visual Quality
- [ ] All text is readable (high contrast)
- [ ] Analytics cards are professional
- [ ] No gradient overlays on text
- [ ] Clean backgrounds
- [ ] Proper spacing

### Functionality
- [ ] All links work
- [ ] All buttons work
- [ ] Animations are smooth (not gimmicky)
- [ ] Responsive design works

### Performance
- [ ] Page loads quickly
- [ ] Images optimized
- [ ] No layout shifts

### Accessibility
- [ ] Contrast ratios meet WCAG AA
- [ ] Keyboard navigation works
- [ ] Screen readers can navigate
- [ ] Alt text on images

---

## 📈 Success Metrics

After migration, you should see:

- ✅ **1 component** instead of 3+
- ✅ **Consistent UI** across all profile types
- ✅ **High contrast** (WCAG AAA)
- ✅ **Professional appearance**
- ✅ **Easier maintenance**
- ✅ **Better user trust**

---

## 🎯 Timeline Estimate

| Phase | Time | Notes |
|-------|------|-------|
| Preparation | 15 min | Read docs, test component |
| BrandProfilePage | 30 min | Data mapping + testing |
| UserProfilePage | 30 min | Data mapping + testing |
| ProjectProfilePage | 30 min | Data mapping + testing |
| Cleanup | 30 min | Remove old components |
| Testing | 1 hour | Thorough verification |
| Documentation | 15 min | Update docs |
| **Total** | **~3 hours** | For 3 profile pages |

---

## 🚀 Ready to Migrate?

1. **Start with one profile type** (e.g., BrandProfilePage)
2. **Test thoroughly** before moving to next
3. **Keep backups** of original files
4. **Use the conversion helper** function
5. **Follow this checklist** step by step

---

## 📞 Need Help?

**Guide:** `/UNIFIED_PROFILE_GUIDE.md`  
**Component:** `/src/app/components/UnifiedProfileLayout.tsx`  
**Design Tokens:** `/DESIGN_TOKENS.md`  
**Analytics Cards:** `/src/app/components/AnalyticsCard.tsx`

---

**One layout. All profiles. Consistent experience.** 🎯

**Start migrating now!** 🚀
