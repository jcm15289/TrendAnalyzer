# PSG Column Display Fix

## Date: November 4, 2025

## Problem
The PSG column was being accidentally removed from the column order, despite PSG values being calculated correctly. Users saw PSG in the header but the column was not appearing in the table.

## Root Cause

**File**: `src/app/stock-table-page.tsx`  
**Lines**: 1852-1858 (before fix)

The bug was in the column reordering logic that repositions "PE vs Avg" and "PS vs Avg" columns:

```typescript
// BUGGY CODE - Sequential splicing causes index shift
if (peVsAvgIndex !== -1) {
    finalOrder.splice(peVsAvgIndex, 1);  // Removes at index 11
}
if (psVsAvgIndex !== -1) {
    finalOrder.splice(psVsAvgIndex, 1);  // Still uses index 12, but PSG is now there!
}
```

**The Issue**:
1. Initial column order: `[..., PE, PE vs Avg, PS, PS vs Avg, PSG, DCF]`
2. `PE vs Avg` is at index 11, `PS vs Avg` is at index 12, `PSG` is at index 13
3. When `PE vs Avg` (index 11) is removed, all subsequent columns shift left by 1
4. Now `PS vs Avg` is at index 11, but `PSG` is at index 12
5. Code still tries to remove index 12 → **accidentally removes PSG instead of PS vs Avg!**

## Solution

**Fixed Code** (lines 1852-1857):
```typescript
// Remove both columns from their current positions first
// Splice in reverse order to avoid index shifting issues
const indicesToRemove = [peVsAvgIndex, psVsAvgIndex].filter(i => i !== -1).sort((a, b) => b - a);
indicesToRemove.forEach(index => {
    finalOrder.splice(index, 1);
});
```

**How it works**:
1. Collect both indices: `[11, 12]`
2. Sort in **descending order**: `[12, 11]`
3. Remove from **highest to lowest** index
4. This prevents index shifting from affecting subsequent removals

## Verification

### Before Fix:
```
🔍 Column ordering - PSG index: -1  ❌
🔍 Final column order: [Company, Sym, PM, GM, Growth, LastQG, PS, PE, PE vs Avg, PEG, GEst, Target, PS vs Avg, DCF]
                       ^ PSG is MISSING
```

### After Fix:
```
🔍 Column ordering - PSG index: 13  ✅
🔍 Final column order: [Company, Sym, PM, GM, Growth, LastQG, PS, PS vs Avg, PE, PE vs Avg, PEG, GEst, Target, PSG, DCF]
                                                                                                         ^^^^
                                                                                                    PSG is PRESENT
```

### PSG Calculation Examples:
```
💾 PSG value for TOST: psg=0.016565656565656565  → Displays as: 0.02
💾 PSG value for UBER: psg=3.0625000000000004     → Displays as: 3.06
💾 PSG value for AAPL: psg=0.6488294314381271     → Displays as: 0.65
💾 PSG value for NVDA: psg=0.3855619360131255     → Displays as: 0.39
```

## Impact

✅ **PSG column now displays correctly** for all stocks with valid PS, GM, and Growth data  
✅ **PSG values formatted to 2 decimal places** for readability  
✅ **Column ordering logic is now robust** against index shifting issues  

## Related Files

- `src/app/stock-table-page.tsx` - Column ordering logic (FIXED)
- `src/app/actions.ts` - PSG calculation logic (unchanged, working correctly)
- `src/components/app/stock-table-wrapper.tsx` - PSG formatting logic (unchanged, working correctly)

## Testing

1. **Local testing**: Confirmed PSG column appears at index 13
2. **Console logs**: Verified PSG values are calculated and stored
3. **Visual testing**: PSG column header and values display correctly
4. **Production deployment**: Changes pushed to trigger Vercel deployment

## Deployment

- **Commit**: 002c683
- **Branch**: main
- **Status**: Pushed to GitHub, deploying to Vercel

