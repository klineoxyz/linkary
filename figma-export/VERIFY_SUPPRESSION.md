# 🧪 Verify EVM Suppression is Working

## Quick Test

Open browser console (F12) and run these commands:

### **Test 1: EVM Warning (Should NOT appear)**
```javascript
console.warn('[EVM] Failed to proxy request method');
console.warn('[EVM] Failed to proxy send method');
console.warn('[EVM] Failed to proxy sendAsync method');
```
**Expected:** ✅ Nothing appears (suppressed)

### **Test 2: Injected Warning (Should NOT appear)**
```javascript
console.warn('[injected|warn]: Test message');
console.error('[injected|error]: Test message');
```
**Expected:** ✅ Nothing appears (suppressed)

### **Test 3: Normal Warning (SHOULD appear)**
```javascript
console.warn('This is a normal warning');
console.error('This is a normal error');
```
**Expected:** ✅ Both messages appear normally

### **Test 4: Wallet Warnings (Should NOT appear)**
```javascript
console.warn('MetaMask detected');
console.warn('Ethereum provider found');
console.warn('Proxy failed');
```
**Expected:** ✅ Nothing appears (suppressed)

---

## Full Verification Checklist

### ✅ **Step 1: Hard Refresh**
- [ ] Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- [ ] Console is empty on load

### ✅ **Step 2: Check for EVM Errors**
- [ ] No `[EVM]` messages
- [ ] No `[injected|warn]` messages
- [ ] No `Failed to proxy` messages

### ✅ **Step 3: Test Suppression**
- [ ] Run Test 1 above (nothing shows)
- [ ] Run Test 2 above (nothing shows)
- [ ] Run Test 3 above (both show)

### ✅ **Step 4: Real Errors Still Work**
```javascript
// This SHOULD appear:
console.error('Application error test');
throw new Error('Test error');
```
- [ ] Both errors appear normally

---

## Automated Test Script

Copy and paste this entire block into console:

```javascript
(function() {
  console.log('%c🧪 Testing EVM Suppression...', 'color: #6366f1; font-weight: bold; font-size: 14px;');
  
  let passed = 0;
  let failed = 0;
  
  // Save original methods to check if blocked
  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = function() {
    warnCalled = true;
    originalWarn.apply(console, arguments);
  };
  
  // Test 1: EVM warning should be blocked
  console.log('%c Test 1: EVM warning suppression', 'color: #8b5cf6; font-weight: bold;');
  warnCalled = false;
  console.warn('[EVM] Failed to proxy request method');
  if (!warnCalled) {
    console.log('%c   ✅ PASS - EVM warning suppressed', 'color: #10b981;');
    passed++;
  } else {
    console.log('%c   ❌ FAIL - EVM warning NOT suppressed', 'color: #ef4444;');
    failed++;
  }
  
  // Test 2: Injected warning should be blocked
  console.log('%c Test 2: Injected warning suppression', 'color: #8b5cf6; font-weight: bold;');
  warnCalled = false;
  console.warn('[injected|warn]: Test message');
  if (!warnCalled) {
    console.log('%c   ✅ PASS - Injected warning suppressed', 'color: #10b981;');
    passed++;
  } else {
    console.log('%c   ❌ FAIL - Injected warning NOT suppressed', 'color: #ef4444;');
    failed++;
  }
  
  // Test 3: Normal warning should pass through
  console.log('%c Test 3: Normal warning pass-through', 'color: #8b5cf6; font-weight: bold;');
  warnCalled = false;
  console.warn('Normal warning test');
  if (warnCalled) {
    console.log('%c   ✅ PASS - Normal warning allowed', 'color: #10b981;');
    passed++;
  } else {
    console.log('%c   ❌ FAIL - Normal warning blocked', 'color: #ef4444;');
    failed++;
  }
  
  // Test 4: Wallet warning should be blocked
  console.log('%c Test 4: Wallet warning suppression', 'color: #8b5cf6; font-weight: bold;');
  warnCalled = false;
  console.warn('MetaMask provider detected');
  if (!warnCalled) {
    console.log('%c   ✅ PASS - Wallet warning suppressed', 'color: #10b981;');
    passed++;
  } else {
    console.log('%c   ❌ FAIL - Wallet warning NOT suppressed', 'color: #ef4444;');
    failed++;
  }
  
  // Test 5: Proxy warning should be blocked
  console.log('%c Test 5: Proxy warning suppression', 'color: #8b5cf6; font-weight: bold;');
  warnCalled = false;
  console.warn('Failed to proxy send method');
  if (!warnCalled) {
    console.log('%c   ✅ PASS - Proxy warning suppressed', 'color: #10b981;');
    passed++;
  } else {
    console.log('%c   ❌ FAIL - Proxy warning NOT suppressed', 'color: #ef4444;');
    failed++;
  }
  
  // Results
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #6366f1;');
  if (failed === 0) {
    console.log('%c✅ All Tests PASSED! (' + passed + '/5)', 'color: #10b981; font-weight: bold; font-size: 16px;');
    console.log('%c🎉 EVM suppression is working perfectly!', 'color: #10b981; font-weight: bold;');
  } else {
    console.log('%c⚠️  Some Tests FAILED (' + passed + '/' + (passed + failed) + ')', 'color: #ef4444; font-weight: bold; font-size: 16px;');
    console.log('%c❌ EVM suppression needs attention', 'color: #ef4444; font-weight: bold;');
  }
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #6366f1;');
})();
```

---

## Expected Test Output

### ✅ **All Tests Pass:**
```
🧪 Testing EVM Suppression...
 Test 1: EVM warning suppression
   ✅ PASS - EVM warning suppressed
 Test 2: Injected warning suppression
   ✅ PASS - Injected warning suppressed
 Test 3: Normal warning pass-through
   ✅ PASS - Normal warning allowed
 Test 4: Wallet warning suppression
   ✅ PASS - Wallet warning suppressed
 Test 5: Proxy warning suppression
   ✅ PASS - Proxy warning suppressed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All Tests PASSED! (5/5)
🎉 EVM suppression is working perfectly!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## What To Do If Tests Fail

### **If Test 1 or 2 Fails (EVM/Injected not suppressed):**

1. **Hard refresh:**
   ```bash
   Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
   ```

2. **Clear cache:**
   ```bash
   DevTools → Application → Clear Storage → Clear site data
   ```

3. **Check index.html loaded:**
   ```bash
   DevTools → Network → Refresh → Look for index.html (status 200)
   ```

4. **Verify suppression code:**
   ```bash
   DevTools → Sources → index.html → Check first <script> tag
   ```

### **If Test 3 Fails (Normal warnings blocked):**

This means the filter is TOO aggressive. Check that your console.warn test doesn't include any blocked keywords like:
- 'injected', 'evm', 'proxy', 'wallet', 'ethereum', etc.

### **If All Tests Fail:**

The suppression isn't loading. Check:
1. Is `/index.html` being served correctly?
2. Is the `<script>` tag at the very top of `<head>`?
3. Are there any syntax errors in the suppression code?
4. Try opening in incognito/private mode

---

## Browser-Specific Notes

### **Chrome/Edge:**
- Suppression should work 100%
- If not, check chrome://extensions
- Disable all wallet extensions temporarily

### **Firefox:**
- Suppression should work 100%
- If not, check about:addons
- Disable all wallet extensions temporarily

### **Safari:**
- Usually no wallet extensions
- Should work 100% without any issues

### **Brave:**
- Built-in crypto wallet may cause issues
- Go to brave://settings/wallet
- Set "Default cryptocurrency wallet" to "None"

---

## Final Checklist

After running all tests:

- [ ] ✅ No `[EVM]` errors on page load
- [ ] ✅ No `[injected|warn]` errors on page load
- [ ] ✅ Automated test script shows 5/5 passed
- [ ] ✅ Normal console warnings still work
- [ ] ✅ React DevTools warnings still show
- [ ] ✅ Network errors still show
- [ ] ✅ Application errors still show

**If all checkboxes are checked, suppression is working perfectly!** ✅

---

## Quick Reference

| Test | Command | Expected Result |
|------|---------|-----------------|
| EVM Error | `console.warn('[EVM] test')` | ✅ Nothing (suppressed) |
| Injected | `console.warn('[injected] test')` | ✅ Nothing (suppressed) |
| Normal | `console.warn('normal test')` | ✅ Shows normally |
| Wallet | `console.warn('metamask')` | ✅ Nothing (suppressed) |
| Error | `console.error('test error')` | ✅ Shows normally |

---

**Last Updated:** February 16, 2026  
**Purpose:** Verify EVM suppression is working correctly  
**Time Required:** 2 minutes
