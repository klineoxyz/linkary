# ⚡ Monetization System - Quick Start Guide

**For:** Developers implementing Linkary monetization  
**Time to Read:** 3 minutes

---

## 🎯 What You Have

✅ **5-tier pricing system** - Free, Pro, Host, Brand, Venture  
✅ **Billing management** - Subscriptions, payments, history  
✅ **Plan gating** - Feature locks with upgrade modals  
✅ **Enhanced calendar** - Event hosting with speaker requests  
✅ **Host dashboard** - Analytics and speaker management  
✅ **Availability system** - Toggles and reputation badges  
✅ **Plan badges** - PRO/HOST/BRAND/VENTURE labels  

---

## 📁 Files Created

```
/src/app/components/monetization/
├── PricingPage.tsx              ← Main pricing page
├── BillingPage.tsx              ← Subscription management
├── LockedFeatureModal.tsx       ← Upgrade prompts
├── PlanBadge.tsx                ← User badges
├── EnhancedCalendarPage.tsx     ← Calendar with gating
├── HostDashboard.tsx            ← Host analytics
└── AvailabilitySettings.tsx     ← Availability toggles
```

---

## 🔗 Already Integrated

✅ **Navigation added** to App.tsx sidebar  
✅ **Routing configured** for all pages  
✅ **Components imported** and ready to use  

---

## 🚀 Quick Access

### **View Pricing**
```typescript
setRoute({ name: "pricing" });
```

### **View Billing**
```typescript
setRoute({ name: "billing" });
```

### **View Availability Settings**
```typescript
setRoute({ name: "availability" });
```

### **View Enhanced Calendar**
```typescript
setRoute({ name: "enhancedCalendar" });
```

### **View Host Dashboard**
```typescript
setRoute({ name: "hostDashboard" });
```

---

## 🔒 How to Gate a Feature

```typescript
import LockedFeatureModal from "./components/monetization/LockedFeatureModal";

// State
const [showLockedModal, setShowLockedModal] = useState(false);
const [lockedFeature, setLockedFeature] = useState<any>(null);

// Check and gate
const handleFeature = () => {
  if (userPlan === "free") {
    setLockedFeature({
      name: "Feature Name",
      plan: "pro", // or "host", "brand", "venture"
      description: "Feature description..."
    });
    setShowLockedModal(true);
  } else {
    // Execute feature
  }
};

// Render modal
<LockedFeatureModal
  isOpen={showLockedModal}
  onClose={() => setShowLockedModal(false)}
  featureName={lockedFeature?.name}
  requiredPlan={lockedFeature?.plan}
  description={lockedFeature?.description}
  onUpgrade={() => setRoute({ name: "pricing" })}
/>
```

---

## 🏷️ How to Use Plan Badges

```typescript
import PlanBadge from "./components/monetization/PlanBadge";

// In your component
<div className="flex items-center gap-2">
  <span>{user.name}</span>
  <PlanBadge plan="pro" size="sm" />
</div>
```

**Plans:**
- `"free"` - No badge shown
- `"pro"` - Indigo PRO badge
- `"host"` - Purple HOST badge
- `"brand"` - Amber BRAND badge
- `"venture"` - Red VENTURE badge

**Sizes:**
- `"sm"` - Small (default)
- `"md"` - Medium

---

## 📊 Pricing Tiers

| Plan | Price | Key Feature |
|------|-------|-------------|
| Free | $0 | Basic features |
| Creator Pro | $9/mo | Request to speak |
| X Space Host | $9.99/mo | Host events |
| Brand/Project | $39/mo | Full KOL Lists |
| Venture | $99/mo | Capital circles |

---

## 🎨 Design Compliance

✅ White backgrounds  
✅ Zinc-900 headings  
✅ Zinc-700 body text  
✅ Zinc-600 meta text  
✅ Indigo-600 primary CTA  
✅ No low-contrast UI  
✅ Clean Stripe/Linear style  

---

## ⚠️ Important Notes

### **This is UI Design Only**

❌ No payment processing  
❌ No subscription logic  
❌ No backend integration  
❌ No real gating enforcement  

✅ Professional UI components  
✅ Clear placeholder labels  
✅ Production-ready design  
✅ Easy to integrate  

### **What You Need to Add**

1. **Payment Processor** (Stripe/Paddle)
2. **Subscription Management** API
3. **Access Control** Middleware
4. **Analytics Calculation** Engine
5. **Email Notifications** System
6. **Calendar Sync** Integration
7. **Badge Calculation** Logic

---

## 📖 Full Documentation

See `/MONETIZATION_SYSTEM_COMPLETE.md` for:
- Complete component documentation
- Integration examples
- Design system details
- Implementation guide
- Backend requirements

---

## 🎯 Navigation Structure

```
Sidebar
├── Workspace
├── Circles & Networks
├── Analytics & Verification
├── Public Profiles
├── Monetization          ← NEW
│   ├── Pricing          ← NEW
│   ├── Billing          ← NEW
│   └── Availability     ← NEW
└── Account
```

---

## 🔄 User Flow Examples

### **Free User Tries to Host Event**
1. Click "Create Event" on calendar
2. `LockedFeatureModal` appears
3. Shows "X Space Host" plan ($9.99/mo)
4. "Upgrade to Host Plan" button
5. Redirects to pricing page

### **Pro User Requests to Speak**
1. Click "Request to Speak" on event
2. Form opens (no gating)
3. Fill topic, pitch, links
4. Submit (placeholder)

### **Host Views Speaker Requests**
1. Navigate to hosted event
2. Click "Speaker Requests" tab
3. See Pending/Accepted/Rejected tabs
4. Accept or reject requests
5. View analytics sidebar

---

## ✅ Quick Checklist

Before deploying:

- [ ] Test all navigation links
- [ ] Verify pricing page displays correctly
- [ ] Check billing page layout
- [ ] Test locked feature modal on free plan
- [ ] Verify plan badges render properly
- [ ] Test calendar event cards
- [ ] Check host dashboard tabs
- [ ] Verify availability toggles work
- [ ] Test responsive design
- [ ] Review all placeholder labels

---

## 🚀 Getting Started

1. **Navigate to pricing:**
   ```typescript
   setRoute({ name: "pricing" });
   ```

2. **Test plan gating:**
   - Set `userPlan="free"` in EnhancedCalendarPage
   - Try creating event
   - Should show upgrade modal

3. **View all components:**
   - Pricing → Full pricing page
   - Billing → Subscription management
   - Availability → Toggles and reputation

4. **Customize:**
   - All components are editable
   - Update demo data
   - Adjust styling
   - Add real backend

---

## 💡 Pro Tips

1. **Consistent User Plan:**
   Pass `userPlan` prop to components that need gating

2. **Reusable Modal:**
   Use `LockedFeatureModal` for any gated feature

3. **Plan Badges:**
   Show badges next to usernames for social proof

4. **Analytics:**
   All metrics are placeholders - replace with real data

5. **Responsive:**
   All components are mobile-friendly

---

## 📞 Need Help?

- **Full docs:** `/MONETIZATION_SYSTEM_COMPLETE.md`
- **Component code:** `/src/app/components/monetization/`
- **Questions:** Check documentation first

---

**✅ Ready to monetize Linkary!**

Components: 7  
Lines: ~1,870  
Status: Production UI Ready  
Backend: Integration Required  

🎉 **Happy building!**
