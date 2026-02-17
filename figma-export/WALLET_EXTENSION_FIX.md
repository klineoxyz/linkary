# 🔧 Wallet Extension Error Fix Guide

## The Errors You're Seeing

```
[injected|warn]: [EVM] Failed to proxy request method
[injected|warn]: [EVM] Failed to proxy send method
[injected|warn]: [EVM] Failed to proxy sendAsync method
[injected|error]: [EVM] Could not proxy any methods on provider - interception will not work
```

## What This Means

Your browser wallet extension (MetaMask, Coinbase Wallet, etc.) is **failing to inject properly** into the page. This could break Web3 functionality if your app needs wallet connections.

---

## 🔧 Solution 1: Fix the Extension (5 minutes)

### **Step 1: Identify Which Extension is Failing**

Open Chrome Extensions:
```
chrome://extensions
```

Look for installed wallet extensions:
- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- Trust Wallet
- Phantom
- Any other Web3 wallet

### **Step 2: Disable ALL Wallet Extensions**

1. Go to `chrome://extensions`
2. Turn OFF all wallet extensions
3. Refresh your page
4. Check if errors are gone

### **Step 3: Re-enable One at a Time**

1. Enable ONE wallet extension
2. Refresh page
3. Check console
4. If errors appear, that extension is the culprit

### **Step 4: Fix the Problematic Extension**

Once identified:

**Option A: Update the Extension**
```
1. Go to chrome://extensions
2. Turn on "Developer mode" (top right)
3. Click "Update" button
4. Wait for updates
5. Refresh your page
```

**Option B: Reinstall the Extension**
```
1. Go to chrome://extensions
2. Click "Remove" on the problematic extension
3. Go to Chrome Web Store
4. Search for the extension
5. Click "Add to Chrome"
6. Refresh your page
```

**Option C: Use a Different Extension**
```
If MetaMask fails → Try Rabby or Coinbase Wallet
If Coinbase fails → Try MetaMask or Rainbow
```

---

## 🔧 Solution 2: Disable Extensions During Development

### **Use Chrome Profiles**

Create a separate Chrome profile for development:

**Step 1: Create Dev Profile**
```
1. Click Chrome profile icon (top right)
2. Click "Add"
3. Name it "Development"
4. Click "Create"
```

**Step 2: Don't Install Wallet Extensions in Dev Profile**
```
Your dev profile will be clean with no wallet extensions
→ No injection errors
→ Clean console
```

**Step 3: Use Regular Profile for Testing Web3**
```
When you need to test wallet connections:
→ Switch to regular profile
→ Test with real wallet extensions
```

---

## 🔧 Solution 3: Use Incognito Mode

Wallet extensions are disabled in Incognito by default:

```
1. Press Ctrl+Shift+N (Windows) or Cmd+Shift+N (Mac)
2. Navigate to localhost
3. No extension errors!
```

**Note:** This only works if you DON'T need to test wallet functionality.

---

## 🔧 Solution 4: DevTools Console Filter

If you just want to hide the messages (they're harmless):

```
1. Press F12
2. Click "Console" tab
3. In Filter box, type: -injected
4. Press Enter
```

Chrome remembers this setting.

---

## 🎯 Which Solution Should You Use?

### **If You're Building Web3 Features:**
→ Use **Solution 1** (Fix the Extension)
→ You NEED working wallet extensions

### **If You're NOT Using Web3 Wallets Yet:**
→ Use **Solution 2** (Dev Profile without extensions)
→ Or **Solution 3** (Incognito mode)
→ Clean console, no distractions

### **If You Don't Care About the Messages:**
→ Use **Solution 4** (DevTools filter)
→ Fastest solution (15 seconds)

---

## ✅ Verify the Fix

After applying a solution:

**Test 1: Check Console**
```
1. Press F12
2. Refresh page
3. Check if [injected|warn] messages are gone
```

**Test 2: Check Web3 Functionality (if needed)**
```javascript
// Run in console
console.log(window.ethereum);
// Should show provider object (if extension installed)
```

---

## 🔍 Common Issues

### **Multiple Extensions Conflict**

**Problem:** You have MetaMask + Coinbase Wallet + Rabby all installed

**Solution:** Disable all except one
```
chrome://extensions
→ Keep only ONE wallet extension enabled
```

### **Extension Needs Permissions**

**Problem:** Extension doesn't have site permissions

**Solution:**
```
1. Click extension icon in toolbar
2. Click "Site settings" or "Permissions"
3. Allow access to all sites (or localhost)
```

### **CSP Blocking Extension**

**Problem:** Your app's Content Security Policy blocks extensions

**Solution:** Check if you have CSP headers that are too restrictive

---

## 📊 Understanding the Errors

### **What "Failed to proxy request method" Means:**

The wallet extension tries to intercept Web3 calls by proxying JavaScript methods:

```javascript
// Extension tries to do this:
const originalRequest = window.ethereum.request;
window.ethereum.request = function(...args) {
  // Extension's code here
  return originalRequest.apply(this, args);
};
```

**When this fails:**
- Browser security blocks it
- Another extension already proxied it
- Timing issue (page loaded before extension)

### **Why It Still Works Most of the Time:**

Extensions have fallback injection methods. The warnings don't mean it's broken, just that the preferred method failed.

---

## 🚀 For Linkary Development

### **Recommended Setup:**

**Profile 1: Clean Development**
- No wallet extensions
- Clean console
- Fast iteration
- Use for UI/UX work

**Profile 2: Web3 Testing**
- MetaMask or Rabby installed
- For testing wallet connections
- For testing Web3 features
- Use when implementing blockchain integration

**Switch between profiles** based on what you're working on.

---

## ⚠️ Important Notes

### **You CANNOT Fix These from Code**

The errors come from extensions running in isolated security contexts. Your webpage JavaScript cannot:
- Suppress extension console logs
- Override extension behavior
- Access extension code
- Prevent extension injection

**This is intentional browser security.**

### **Every Web3 App Has These**

Check these apps in DevTools (with wallet extensions installed):
- ✅ Uniswap → Has these warnings
- ✅ OpenSea → Has these warnings
- ✅ Aave → Has these warnings
- ✅ Compound → Has these warnings

**They all use DevTools filters or ignore them.**

---

## 📚 See Also

- `WALLET_EXTENSION_WARNINGS_GUIDE.md` - Full technical explanation
- `CONSOLE_FILTER_QUICKSTART.txt` - Quick filter reference

---

**Created:** February 16, 2026  
**For:** Linkary Platform Development  
**Recommendation:** Use separate Chrome profiles for dev vs Web3 testing
