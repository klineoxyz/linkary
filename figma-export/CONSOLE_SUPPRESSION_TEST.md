# Console Suppression - Test Instructions 🧪

## Quick Test

Open your browser's **DevTools Console** and run this test:

### Test 1: Normal Logs (Should Appear) ✅

```javascript
console.log("✅ TEST: This normal log appears");
console.warn("⚠️ TEST: This normal warning appears");
console.error("❌ TEST: This normal error appears");
```

**Expected**: All three messages appear in console

---

### Test 2: EVM Warnings (Should Be Suppressed) 🛡️

```javascript
console.warn("[injected|warn]: [EVM] Failed to proxy request method");
console.warn("[injected|warn]: [EVM] Failed to proxy send method");
console.error("[injected|error]: [EVM] Could not proxy any methods on provider");
```

**Expected**: None of these messages appear (suppressed)

---

### Test 3: Mixed Messages

```javascript
console.log("Normal log 1");
console.warn("[EVM] This should be hidden");
console.log("Normal log 2");
console.error("injected| This should be hidden");
console.log("Normal log 3");
```

**Expected**: Only "Normal log 1", "Normal log 2", "Normal log 3" appear

---

## Visual Verification

### ✅ Working Correctly:

```
Console (3 messages)
✅ TEST: This normal log appears
⚠️ TEST: This normal warning appears  
❌ TEST: This normal error appears
```

### ❌ Not Working (If You See):

```
Console (6 messages)
[injected|warn]: [EVM] Failed to proxy request method
[injected|warn]: [EVM] Failed to proxy send method
✅ TEST: This normal log appears
⚠️ TEST: This normal warning appears
❌ TEST: This normal error appears
[injected|error]: [EVM] Could not proxy...
```

---

## Troubleshooting

### If Suppression Isn't Working:

1. **Hard Refresh**:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Clear Cache**:
   - Open DevTools → Network tab
   - Right-click → "Clear browser cache"
   - Refresh page

3. **Verify Code Placement**:
   - Open `/src/app/App.tsx`
   - Suppression code should be **lines 1-19**
   - Should be **before** all imports

4. **Check for Multiple Entry Points**:
   - In Figma Make, `App.tsx` is the entry
   - Suppression runs immediately when file is parsed

5. **Disable Other Extensions**:
   - Some extensions may override console methods
   - Temporarily disable to test

---

## Expected Behavior

### On Initial Page Load:

You may see **1-2 EVM warnings** appear briefly, then:
- ✅ All subsequent EVM warnings are suppressed
- ✅ Your app's logs work normally
- ✅ Console stays clean

### Why Some Initial Warnings Appear:

Browser extensions inject in a **separate context** that runs before your bundle loads. The very first injection attempt may log before our suppression code executes. This is **normal and expected**.

**After that first moment, all warnings are suppressed.** 🛡️

---

## Success Criteria

✅ **Passing Test**:
- Normal logs appear
- EVM/injected warnings don't appear (after initial page load)
- Console is clean and usable
- No impact on debugging

❌ **Failing Test**:
- EVM warnings continuously spam console
- Normal logs are also suppressed
- Console methods throw errors

---

## Real-World Test

1. Open Linkary app
2. Open DevTools Console
3. Navigate between pages
4. Add these test logs to a component:

```typescript
useEffect(() => {
  console.log("✅ Component mounted - this appears");
  console.warn("⚠️ Component warning - this appears");
  
  // These should NOT appear:
  console.warn("[EVM] Test suppression");
  console.error("injected| Test suppression");
}, []);
```

5. Verify only the first two messages appear

---

## Monitoring in Production

Add a debug panel to verify suppression is active:

```typescript
// In App.tsx or a debug component
const checkSuppression = () => {
  console.log("🛡️ Console suppression status:");
  console.log("✅ Normal logs: WORKING");
  console.warn("✅ Normal warnings: WORKING");
  
  // Try to log EVM warning (should be suppressed)
  console.warn("[EVM] Test - if you see this, suppression failed");
  
  console.log("🛡️ Check complete - if you don't see the EVM test message, suppression is ACTIVE");
};

// Run on mount
useEffect(() => {
  checkSuppression();
}, []);
```

---

## Summary

✅ **Suppression Active** = Clean console, only your app's logs  
❌ **Suppression Inactive** = EVM warnings spam console  

**The fix is working if your console looks like a normal app console, not a Web3 extension debug log!** 🎉
