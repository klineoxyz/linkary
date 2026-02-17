# Linkary - Individual User Profile Pages

## Overview

Beautiful, vibrant individual user profile pages with glassmorphism effects, gradient backgrounds, and smooth animations. These pages showcase user reputation, work, partnerships, and more in a visually stunning layout.

## Features

### ✨ Visual Design
- **Glassmorphism cards** with backdrop blur effects
- **Gradient backgrounds** with multiple overlay effects
- **Smooth animations** using Framer Motion
- **Vibrant color schemes** throughout
- **Responsive grid layout** (3-column on desktop)

### 📊 Profile Sections

1. **Profile Card (Left Column)**
   - Cover image grid (2 photos)
   - Avatar with verified badge
   - Social media icons (hover effect)
   - User name, handle, and location
   - Role tags with gradient styling
   - Quick stats (Deals, Completion %, Rating)
   - Star rating display
   - Earnings information
   - Message and Copy buttons

2. **Ambassador & Partnership Cards**
   - Ambassador roles with gradient backgrounds
   - Partnership logos and verified badges
   - Interactive hover effects

3. **Main Content (Center Column)**
   - **Credibility Scores**: ETHOS, XScore, Index, Power
   - **Featured Work**: Project showcase with images and views
   - **Case Studies**: Verified project work with metrics
     - Engagement results
     - Client testimonials
     - Verified deal badges

4. **Social & Events (Right Column)**
   - **Social Links**: Platform cards with metrics
     - Follower counts
     - Click-through stats
     - Direct links to profiles
   - **Upcoming Events**: X Spaces, Podcasts
     - Event type badges
     - Date and time
     - Reminder functionality
   - **Quick Stats**: Earnings, completion, disputes, deals

## How to Access

### 1. From Overview Page
Click the **"View Public Profile"** button (purple/pink gradient) in the top right of the Overview page.

### 2. From Featured Creators
Click the **"View"** button on any creator card in the Featured Creators section.

### 3. From Leaderboards
Click on any creator card in the Top Creators leaderboard.

### 4. From Topbar
Click on your avatar and name in the top navigation bar.

## Navigation

The profile page is accessed via the route:
```javascript
setRoute({ name: "userProfile", handle: "Muazxinthi" })
```

## Component Location

```
/src/app/components/UserProfilePage.tsx
```

## Customization

### Adding New Users

Update the `demoUser` object in `/src/app/components/UserProfilePage.tsx`:

```typescript
const demoUser: UserProfile = {
  handle: "YourHandle",
  name: "Your Name",
  // ... other fields
}
```

### Styling

The profile uses:
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons

Key color schemes:
- Indigo/Purple gradients for primary actions
- Emerald/Cyan for partnerships
- Amber/Orange for events
- Custom gradients for cover images

## Example Profile URL

In a production environment, profiles would be accessible at:
```
https://linkary.xyz/Muazxinthi
```

## Design Inspiration

This implementation is based on:
- **Link3**: Social card layouts with metrics
- **Bento**: Clean profile aesthetics
- **Trustpilot**: Review and rating displays
- **Nova Martial Arts** (HTML example): Glassmorphism and animations

## Key Animations

1. **Page Load**: Staggered fade-in from different directions
   - Left column: slides from left
   - Center: slides from bottom
   - Right: slides from right

2. **Hover Effects**:
   - Cards scale up (1.02x - 1.05x)
   - Borders brighten
   - Background opacity increases

3. **Interactive Elements**:
   - Button press (scale 0.95x)
   - Icon rotations on hover
   - Smooth color transitions

## Future Enhancements

- [ ] Dynamic routing with URL parameters
- [ ] Backend integration for real user data
- [ ] Edit profile functionality
- [ ] More social platform integrations
- [ ] Advanced analytics visualization
- [ ] Video/media gallery support
- [ ] NFT showcase section
- [ ] Token-gated content
