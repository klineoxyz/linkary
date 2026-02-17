# 💰 Linkary Monetization System - Complete Documentation

**Created:** February 16, 2026  
**Status:** ✅ Design Complete (UI Only)  
**Implementation:** Placeholder logic - backend required

---

## 🎯 Overview

Complete monetization layer for Linkary including:
- 5-tier pricing system
- Billing management
- Plan gating & upgrade flows
- Enhanced calendar with event hosting
- Speaker request system
- Event analytics dashboard
- Availability toggles
- Reputation system

**Design Philosophy:** Clean, professional SaaS aesthetic matching Stripe/Linear/Notion style with proper light theme contrast.

---

## 📁 File Structure

```
/src/app/components/monetization/
├── PricingPage.tsx              # 5-tier pricing with comparison table
├── BillingPage.tsx              # Subscription & payment management
├── LockedFeatureModal.tsx       # Reusable upgrade prompt
├── PlanBadge.tsx                # User plan badges (PRO/HOST/BRAND/VENTURE)
├── EnhancedCalendarPage.tsx     # Calendar with gating & speaker requests
├── HostDashboard.tsx            # Host analytics & speaker management
└── AvailabilitySettings.tsx     # Availability toggles & reputation
```

---

## 🎨 Design System Compliance

### **Colors**
✅ White backgrounds  
✅ Zinc-900 headings  
✅ Zinc-700 body text  
✅ Zinc-600 meta text  
✅ Indigo-600 primary CTA  
✅ No low-contrast text  
✅ Clean zinc-200 borders  

### **Typography**
- H1: `text-3xl font-bold text-zinc-900`
- H2: `text-xl font-semibold text-zinc-900`
- Body: `text-sm text-zinc-700`
- Meta: `text-xs text-zinc-600`

### **Components**
- Card padding: `p-6`
- Border radius: `rounded-xl`
- Shadows: `shadow-sm` (subtle only)
- Hover states: `hover:shadow-md`

---

## 💎 Pricing Tiers

### **1. Free - $0**
- Public profile
- Link builder
- Join circles
- View events
- Set reminders
- Basic analytics

**CTA:** "Get Started"  
**Color:** Emerald

---

### **2. Creator Pro - $9/month**

**Badge:** "Early Access – 50% off first 3 months"  
**Original Price:** $18 (crossed out)

**Features:**
- Request to speak at events
- Unlimited circles
- Advanced analytics
- Discovery boost
- Export KOL lists
- Availability toggle
- External calendar sync
- Priority support

**CTA:** "Upgrade to Pro"  
**Color:** Indigo

---

### **3. X Space Host - $9.99/month**

**Headline:** "Host & Monetize Your X Spaces"  
**Badge:** "Most Popular" (purple)

**Features:**
- Create unlimited X Spaces
- Accept speaker applications
- Co-host system
- Highlight in discovery
- Event analytics dashboard
- Pin events to profile
- Event replay archive
- Speaker management tools

**CTA:** "Become a Host"  
**Color:** Purple

---

### **4. Brand / Project - $39/month**

**Features:**
- Full KOL Lists
- Campaign intelligence
- Organization circles
- Geo reach targeting
- Invite creators to gigs
- Campaign analytics export
- Team collaboration
- Priority placement

**CTA:** "Start Campaign Plan"  
**Color:** Amber

---

### **5. Venture - $99/month**

**Features:**
- Capital Partner Circles
- Portfolio amplification
- Influence network graph
- Ecosystem analytics
- Portfolio event hosting
- Deal flow intelligence
- White-label reports
- Dedicated support

**CTA:** "Upgrade to Venture"  
**Color:** Red

---

## 📊 Feature Comparison Table

Horizontal table comparing all tiers:

| Feature | Free | Pro | Host | Brand | Venture |
|---------|------|-----|------|-------|---------|
| Public Profile | ✓ | ✓ | ✓ | ✓ | ✓ |
| Host Events | ✗ | ✗ | ✓ | ✓ | ✓ |
| Request to Speak | ✗ | ✓ | ✓ | ✓ | ✓ |
| Circles Limit | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| KOL Lists | ✗ | View Only | View Only | Full Access | Full Access |
| Advanced Analytics | ✗ | ✓ | ✓ | ✓ | ✓ |
| Capital Tools | ✗ | ✗ | ✗ | ✗ | ✓ |
| Event Analytics | ✗ | ✗ | ✓ | ✓ | ✓ |
| Discovery Boost | ✗ | ✓ | ✓ | ✓ | ✓ |
| External Calendar Sync | ✗ | ✓ | ✓ | ✓ | ✓ |

---

## 💳 Billing System

### **Current Plan Card**
- Plan name with status badge (Active)
- Price (with discount if applicable)
- Next billing date
- Discount info banner (if applicable)
- Upgrade/Downgrade/Cancel buttons

### **Discount Display**
Example: "Founding Member Rate – 50% off until May 2026"
- Indigo background
- AlertCircle icon
- Clear expiration date

### **Payment Method Section**
- Card preview (Visa •••• 4242)
- Expiry date
- Default badge
- Update payment button

### **Payment History Table**
Columns:
- Date
- Plan
- Amount
- Status (paid badge)
- Invoice download link

---

## 🔒 Plan Gating System

### **LockedFeatureModal Component**

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredPlan: "pro" | "host" | "brand" | "venture";
  description?: string;
  onUpgrade: () => void;
}
```

**Features:**
- Plan-specific colors and icons
- Feature list for required plan
- Price display
- Upgrade CTA
- Dismissable

**Example Usage:**
```typescript
<LockedFeatureModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  featureName="Host Events"
  requiredPlan="host"
  description="Create and host unlimited X Spaces..."
  onUpgrade={() => setRoute({ name: "pricing" })}
/>
```

---

## 🏷️ Plan Badges

### **PlanBadge Component**

**Props:**
```typescript
{
  plan: "free" | "pro" | "host" | "brand" | "venture";
  size?: "sm" | "md";
}
```

**Variants:**
- **PRO** - Indigo background, Zap icon
- **HOST** - Purple background, Mic icon
- **BRAND** - Amber background, Building2 icon
- **VENTURE** - Red background, TrendingUp icon

**Rendering:**
- Free plan: returns null (no badge)
- Uppercase labels
- Icon + text
- Small, subtle design

**Example:**
```typescript
<PlanBadge plan="pro" size="sm" />
```

---

## 📅 Enhanced Calendar System

### **Event Creation Flow**

**Gating Logic:**
- Free users: Show LockedFeatureModal for "Host Events"
- Pro/Host+ users: Open creation modal

**Creation Form Fields:**
1. **Event Type** (buttons)
   - X Space
   - Podcast
   - AMA
   - Webinar

2. **Title** (text input)
3. **Description** (textarea)
4. **Date & Time** (date + time inputs)
5. **Duration** (dropdown)
   - 30 minutes
   - 1 hour
   - 1.5 hours
   - 2 hours

6. **Visibility** (radio buttons)
   - Public
   - Followers Only
   - Circle Only
   - Invite Only

7. **Max Speaker Slots** (number input)

**CTA:** "Create Event" (placeholder)

---

### **Event Discovery**

**Event Cards Display:**
- Event type icon (color-coded)
- Featured badge (for Host+ plans)
- Title
- Date & time
- Host name + plan badge
- Attendees count
- Speaker avatars
- Action buttons:
  - Set Reminder (all users)
  - Request to Speak (Pro+ users)

**Featured Events:**
- Subtle purple badge
- "Featured" label
- Only for paid host plans
- No flashy animation

---

### **Speaker Request Flow**

**Gating:**
- Free users: Show LockedFeatureModal for "Request to Speak"
- Pro+ users: Open request form

**Request Form:**
1. Event info card (read-only)
2. Topic input (what will you speak about?)
3. Pitch textarea (why should you be selected?)
4. Links input (previous speaking links - optional)
5. Submit button

**Placeholder:** "Speaker request logic required"

---

### **Reminder System**

**For All Users:**
- In-app reminder
- Email reminder
- Bell icon button

**For Pro+ Users:**
- Add to Google Calendar
- Add to Outlook
- External sync integration

**Gating:**
- Free users clicking calendar sync: Show upgrade modal
- Pro+ users: Placeholder alert

---

## 📊 Host Dashboard & Analytics

### **Dashboard Sections**

**Tabs:**
1. Overview
2. Speaker Requests (active)
3. Analytics
4. Settings

---

### **Speaker Request Management**

**Sub-tabs:**
- **Pending** (Amber badge with count)
- **Accepted** (Emerald badge with count)
- **Rejected** (Red badge with count)

**Request Cards:**
- Avatar
- Name + verification badge + plan badge
- Handle
- Topic
- Pitch
- Previous links
- Reach metric
- Submission timestamp
- Accept/Reject buttons (pending only)

**Actions:**
```typescript
handleAccept(requestId);
handleReject(requestId);
```

---

### **Event Analytics Panel**

**Metrics:**

1. **Total RSVPs**
   - Indigo background
   - Bell icon
   - Number display

2. **Reminders Set**
   - Purple background
   - Clock icon
   - Number display

3. **Applications**
   - Emerald background
   - Target icon
   - Number display

4. **Profile Views**
   - Amber background
   - Eye icon
   - Number display

5. **Follower Growth**
   - Indigo background
   - TrendingUp icon
   - +number display

6. **Reminder Conversion %**
   - Purple background
   - BarChart3 icon
   - Percentage display

**Geo Breakdown:**
- Top 5 regions
- MapPin icon
- Country name + count
- Sorted by count descending

**Note:** "Placeholder - data sync required"

---

## 🎤 Availability & Reputation System

### **Availability Toggles**

**1. Available to Speak**
- Purple icon (Mic)
- Toggle switch
- "Active" badge when ON
- Description text
- Profile preview when enabled

**2. Open to Partnerships**
- Indigo icon (Handshake)
- Toggle switch
- "Active" badge when ON
- Description text
- Profile preview when enabled

**Profile Preview:**
Shows how badges appear on public profile:
```
┌──────────────────────────┐
│ [Avatar] Your Name       │
│         @yourhandle      │
│                          │
│ [🎤 Available to Speak]  │
│ [🤝 Open to Partnerships]│
└──────────────────────────┘
```

---

### **Speaker Reputation Badge**

**Requirements:**
- 5+ verified speaking events
- 4.5+ average rating

**Badge:** "Verified X Space Speaker"
- Purple background
- CheckCircle2 icon
- Appears on profile and search results

**Metrics Display:**
- Events Spoken (number)
- Reliability Score (percentage)
- Speaker Rating (stars)
- Avg Event Rating (stars)
- Total Audience Reached (number)

---

### **Host Reputation Metrics**

**Display:**
- Events Hosted
- Reliability Score (%)
- Speaker Satisfaction (stars)
- Avg Attendees (number)

**Note:** "Placeholder - calculated from event history"

---

## 🎨 Component Patterns

### **Stat Card**
```tsx
<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
  <div className="text-xs text-zinc-600 mb-1">Label</div>
  <div className="text-2xl font-bold text-zinc-900">Value</div>
</div>
```

### **Action Button (Primary)**
```tsx
<button className="h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center gap-2">
  <Icon className="h-5 w-5" />
  Action Text
</button>
```

### **Action Button (Secondary)**
```tsx
<button className="h-11 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors">
  Action Text
</button>
```

### **Info Banner**
```tsx
<div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
  <p className="text-sm text-indigo-900">
    <strong>Note:</strong> Message text
  </p>
</div>
```

---

## 🔄 Integration Points

### **Navigation (App.tsx)**

Added to sidebar:
```typescript
<span className="uppercase text-xs font-medium text-zinc-500 mt-6 tracking-wide">
  Monetization
</span>
<div className="flex flex-col gap-2">
  <Link name="pricing" icon={DollarSign} label="Pricing" />
  <Link name="billing" icon={Receipt} label="Billing" />
  <Link name="availability" icon={Users} label="Availability" />
</div>
```

### **Routing (App.tsx)**

```typescript
{route.name === "pricing" && <PricingPage setRoute={setRoute} />}
{route.name === "billing" && <BillingPage setRoute={setRoute} />}
{route.name === "enhancedCalendar" && <EnhancedCalendarPage setRoute={setRoute} userPlan="free" />}
{route.name === "hostDashboard" && <HostDashboard setRoute={setRoute} />}
{route.name === "availability" && <AvailabilitySettings />}
```

---

## 📝 Placeholder Labels

All components include clear placeholder notes:

```typescript
<p className="text-xs text-zinc-500 text-center">
  Placeholder - [specific functionality] required
</p>
```

Examples:
- "Placeholder - payment integration required"
- "Placeholder - event creation logic required"
- "Placeholder - speaker request logic required"
- "Data sync placeholder"

---

## ⚠️ Critical Notes

### **1. Design Only**
This is UI design only. No backend functionality is implemented.

### **2. Placeholder Logic**
All gating, analytics, and payment flows are placeholders for demonstration.

### **3. Backend Requirements**

To make functional:
- Payment processor integration (Stripe/Paddle)
- Subscription management system
- Event creation & management API
- Speaker request workflow
- Analytics calculation engine
- Calendar sync integrations
- Email notification system
- Badge & reputation calculation
- Access control middleware

### **4. No Crypto Hype**
Pricing is professional, clear, and confident. No "sale" language except early access discount.

### **5. Accessibility**
All components follow WCAG AA contrast requirements with light theme.

---

## 🎯 Strategic Intent

### **Core Engine:**
Circles + KOL Lists + X Space Hosting = Growth Infrastructure

### **Pricing Philosophy:**
- Professional (not hype)
- Clear (not confusing)
- Confident (not desperate)
- Fair (not exploitative)

### **UX Goals:**
- Seamless upgrade flows
- Clear feature gating
- No surprise charges
- Transparent pricing
- Easy plan changes

---

## 📊 Component Summary

| Component | Purpose | Lines | Status |
|-----------|---------|-------|--------|
| PricingPage | 5-tier pricing + comparison | 350 | ✅ |
| BillingPage | Subscription management | 250 | ✅ |
| LockedFeatureModal | Upgrade prompts | 150 | ✅ |
| PlanBadge | User badges | 70 | ✅ |
| EnhancedCalendarPage | Calendar + gating | 400 | ✅ |
| HostDashboard | Host analytics | 350 | ✅ |
| AvailabilitySettings | Toggles + reputation | 300 | ✅ |

**Total:** ~1,870 lines of production-quality code

---

## 🚀 Usage Examples

### **Example 1: Show Pricing**
```typescript
setRoute({ name: "pricing" });
```

### **Example 2: Gate Feature**
```typescript
const handleFeature = () => {
  if (userPlan === "free") {
    setLockedFeature({
      name: "Host Events",
      plan: "host",
      description: "Create unlimited X Spaces with the Host plan."
    });
    setShowLockedModal(true);
  } else {
    // Execute feature
  }
};
```

### **Example 3: Display Plan Badge**
```typescript
<div className="flex items-center gap-2">
  <span>Hosted by {event.host}</span>
  <PlanBadge plan="host" size="sm" />
</div>
```

---

## ✅ Deliverables Checklist

- ✅ Pricing page with 5 tiers
- ✅ Feature comparison table
- ✅ Billing management UI
- ✅ Payment method cards
- ✅ Payment history table
- ✅ Locked feature modal
- ✅ Plan badges (4 variants)
- ✅ Event creation flow
- ✅ Speaker request form
- ✅ Host dashboard
- ✅ Event analytics
- ✅ Availability toggles
- ✅ Speaker reputation
- ✅ Host reputation
- ✅ Navigation integration
- ✅ Routing setup
- ✅ Responsive design
- ✅ Light theme compliance
- ✅ Placeholder labels
- ✅ Documentation

---

## 🎨 Design Assets

### **Icons Used:**
- Zap (Pro)
- Mic (Host / Speaking)
- Building2 (Brand)
- TrendingUp (Venture)
- Lock (Locked features)
- CheckCircle2 (Verified)
- Calendar (Events)
- Bell (Reminders)
- Users (Attendees)
- Award (Reputation)

### **Color Palette:**
- Emerald: Free tier
- Indigo: Pro tier, Primary CTA
- Purple: Host tier, Featured
- Amber: Brand tier, Warnings
- Red: Venture tier, Errors

---

## 📞 Support

**Design Questions:** Check this documentation  
**Implementation Help:** Backend integration required  
**Customization:** All components are editable

---

**✅ Monetization system design complete!**

Total Components: 7  
Total Lines: ~1,870  
Design Quality: Professional SaaS  
Status: Ready for backend integration

🚀 **Ready to monetize!**
