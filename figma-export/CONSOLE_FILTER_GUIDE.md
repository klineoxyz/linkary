# 🎯 Console Filter Quick Guide

## ⚡ 10-Second Solution

**Hide wallet warnings in Chrome DevTools:**

```
1. Press F12 (open DevTools)
2. Click "Console" tab
3. Look for the filter text box (top of console)
4. Type: -injected
5. Press Enter
```

**Done!** Wallet warnings are now hidden. ✅

---

## 📸 Visual Guide

### **Step 1: Open Console**
```
Press: F12
Or: Right-click page → Inspect → Console tab
```

### **Step 2: Find Filter Box**
```
┌─────────────────────────────────────────────────────────┐
│ Console    [Filter...]  🚫 Clear  ⚙️ Settings           │
│             ↑↑↑↑↑↑                                      │
│         CLICK HERE                                      │
├─────────────────────────────────────────────────────────┤
│ [injected|warn]: [EVM] Failed to proxy... ← ANNOYING   │
│ [injected|warn]: [EVM] Failed to proxy... ← ANNOYING   │
│ Your actual logs                           ← IMPORTANT  │
└─────────────────────────────────────────────────────────┘
```

### **Step 3: Type Filter**
```
┌─────────────────────────────────────────────────────────┐
│ Console    [-injected]  🚫 Clear  ⚙️ Settings           │
│             ↑↑↑↑↑↑↑↑↑↑↑                                 │
│         TYPE THIS                                       │
├─────────────────────────────────────────────────────────┤
│ Your actual logs                           ← CLEAN! ✅  │
│ No more extension warnings                 ← CLEAN! ✅  │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Filter Options

### **Option 1: Hide "injected" messages**
```
Filter: -injected
```
Hides: `[injected|warn]`, `[injected|error]`

### **Option 2: Hide "EVM" messages**
```
Filter: -evm
```
Hides: `[EVM]` messages

### **Option 3: Hide both (RECOMMENDED)**
```
Filter: -injected -evm
```
Hides: All wallet extension warnings

### **Option 4: Hide all extension noise**
```
Filter: -injected -evm -proxy
```
Hides: Everything related to wallets

---

## ⚙️ Alternative: Settings Method

### **Permanent Solution:**

```
1. Open Console (F12)
2. Click ⚙️ Settings icon (top-right)
3. Find "Filter" section
4. Check ☑ "Hide messages from extensions"
5. Close settings panel
```

**Effect:** ALL extension messages hidden permanently

---

## 🔬 Understanding Filters

### **Syntax:**

| Filter | Meaning | Example |
|--------|---------|---------|
| `text` | Show ONLY messages with "text" | `error` = show only errors |
| `-text` | HIDE messages with "text" | `-injected` = hide injected |
| `text1 text2` | Show messages with text1 OR text2 | `warn error` |
| `-text1 -text2` | Hide text1 AND text2 | `-injected -evm` |

### **Examples:**

```
Filter: error
Result: Only see error messages

Filter: -warn
Result: Hide all warnings

Filter: -injected -evm -proxy
Result: Hide all wallet extension messages

Filter: warn -injected
Result: Show warnings, but hide injected warnings
```

---

## 💡 Pro Tips

### **Tip 1: Filter persists**
Once you set a filter, DevTools remembers it (until you close the tab)

### **Tip 2: Quick toggle**
Click the filter box and press Backspace to clear filter temporarily

### **Tip 3: Regular expressions**
Use `/pattern/` for advanced filtering:
```
Filter: /\[injected/
Result: Hides anything starting with [injected
```

### **Tip 4: Save workspace**
DevTools can save your filter settings:
```
Settings → Workspace → Add folder → Save preferences
```

---

## 📊 Before & After

### **Before (No Filter):**
```console
[injected|warn]: [EVM] Failed to proxy request method
[injected|warn]: [EVM] Failed to proxy send method  
[injected|warn]: [EVM] Failed to proxy sendAsync method
[injected|error]: [EVM] Could not proxy any methods on provider
App.tsx:123 User clicked button
App.tsx:456 Data loaded successfully
[injected|warn]: More wallet noise...
```
❌ Hard to find your logs

### **After (Filter: `-injected`):**
```console
App.tsx:123 User clicked button
App.tsx:456 Data loaded successfully
```
✅ Clean, readable console

---

## 🎯 Recommended Filters

### **For Linkary Development:**

```
-injected -evm -proxy
```

**This hides:**
- ✅ `[injected|warn]` messages
- ✅ `[injected|error]` messages  
- ✅ `[EVM]` messages
- ✅ `proxy` failure messages
- ✅ All wallet extension noise

**This shows:**
- ✅ Your app logs
- ✅ React warnings (important!)
- ✅ Network errors (important!)
- ✅ Your console.log statements

---

## 🚀 Quick Copy-Paste

**Copy this exact filter:**

```
-injected -evm -proxy -interception
```

**Paste in Console filter box → Press Enter → Done!**

---

## ✅ Verification

**After applying filter, you should:**

1. ✅ See your app logs clearly
2. ✅ NOT see `[injected|warn]` messages
3. ✅ NOT see `[EVM]` messages
4. ✅ Still see React errors (if any)
5. ✅ Still see network errors (if any)

---

## 🎯 Bottom Line

**Quick Action:**
```
F12 → Console → Filter box → Type: -injected → Enter
```

**Time:** 10 seconds  
**Effect:** Clean console  
**Cost:** Free  
**Difficulty:** Zero  

**Your app works perfectly.** Just filter the noise! 🎉

---

## 📚 More Info

**Chrome DevTools Console:**
https://developer.chrome.com/docs/devtools/console/

**Filter Reference:**
https://developer.chrome.com/docs/devtools/console/reference/#filter

**Why Wallet Extensions Log:**
See `/WALLET_WARNINGS_EXPLANATION.md`

---

**TL;DR:** Type `-injected` in the Console filter box. Done. ✅
