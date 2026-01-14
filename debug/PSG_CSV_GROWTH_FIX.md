# PSG Calculation Fix: Use CSV Growth Instead of Calculated Growth

## Date: November 4, 2025

## Problem Reported

User reported: "If there is PS, GM and Growth there has to be PSG, here we have the 3 but no PSG"

**Example**: Nelnet (NNI) showed in the table:
- PS: 3
- GM: 83%
- Growth: 61%
- **PSG: 0% or empty** ❌

## Root Cause Analysis

### Investigation Process

1. **Checked PSG column presence**: ✅ Column was visible after previous fix
2. **Checked PSG calculation**: ✅ Formula was correct
3. **Checked server logs**: Found the mismatch!

### The Core Issue

The table displays **two different growth values**:

1. **CSV Growth Column** (displayed in table): 61% for NNI
2. **Calculated Growth** (used by PSG): PE/PEG = 14/(-1.9) = **-7%** for NNI

**Server log evidence**:
```
📊 Using CSV data for NNI: PE="14", PEG="-1.9", PS="3.0", GM="83"
```

PEG is **negative (-1.9)**, so calculated growth is **negative (-7%)**!

### PSG Calculation Logic

```typescript
// Line 440 in actions.ts (before fix)
if (psRatio && growthRate && grossMarginPercent && grossMarginPercent > 0 && growthRate > 0) {
    // PSG = (50/GM) * PS / Growth
    psg = (gmFactor * psRatio) / growthRate;
}
```

**Condition requires `growthRate > 0`**! Since calculated growth was -7%, PSG calculation was skipped.

## The Solution

### Changes Made

1. **Extract CSV Growth value** in `stock-table-page.tsx`:
```typescript
const growthIndex = data.headers.findIndex(h => h.toLowerCase() === 'growth');
const growthValue = growthIndex !== -1 ? row[growthIndex] : null;
```

2. **Pass CSV Growth to calculation function**:
```typescript
const { data: dcfData, error } = await getGestCalculationFromCsv(
    symbol, 
    row[peIndex], 
    row[pegIndex], 
    psValue, 
    gmValue, 
    growthValue  // 👈 NEW
);
```

3. **Update function signature** in `actions.ts`:
```typescript
export async function getGestCalculationFromCsv(
    symbol: string, 
    peValue: string, 
    pegValue: string, 
    psValue?: string | null, 
    gmValue?: string | null, 
    growthValue?: string | null  // 👈 NEW
)
```

4. **Prioritize CSV Growth for PSG**:
```typescript
// Parse CSV Growth
const csvGrowthRate = cleanGrowthValue ? parseFloat(cleanGrowthValue) : null;

// Use CSV Growth if available, otherwise fall back to calculated growth
const psgGrowthRate = csvGrowthRate && csvGrowthRate > 0 ? csvGrowthRate : growthRate;

console.log(`🔍   - Using Growth Rate for PSG: ${psgGrowthRate} (source: ${csvGrowthRate && csvGrowthRate > 0 ? 'CSV' : 'calculated PE/PEG'})`);

if (psRatio && psgGrowthRate && grossMarginPercent && grossMarginPercent > 0 && psgGrowthRate > 0) {
    psg = (gmFactor * psRatio) / psgGrowthRate;
}
```

5. **Fixed scope issues** in `getGestCalculation` (non-CSV path):
- Declared `psg` variable at function level
- Moved PSG calculation inside try-catch block where `psRatio` is defined

## Expected Results

### For NNI (Nelnet):
- **Before**: PSG = null (failed calculation due to negative calculated growth)
- **After**: PSG = (50/83) * 3 / 61 = **0.0296** ≈ **0.03** ✅

### Calculation Breakdown:
```
PS = 3
GM = 83%
Growth = 61% (from CSV, not calculated)
GM Factor = 50 / 83 = 0.6024
PSG = (0.6024 * 3) / 61 = 1.8072 / 61 = 0.0296 ≈ 0.03
```

### Impact

This fix will enable PSG calculations for stocks that have:
- ✅ Valid CSV Growth (positive)
- ✅ Valid PS ratio
- ✅ Valid GM ratio
- ❌ But have negative or zero PEG (which causes calculated growth to fail)

## Why This Happened

The original implementation calculated growth from PE/PEG for consistency across the application. However:

1. **PEG can be negative** or unreliable for some stocks
2. **The CSV already contains a curated Growth value** that might be more reliable
3. **PSG should use the same Growth value displayed in the table** for user clarity

## Testing

### Before Fix:
```bash
npm run monitor  # On localhost:3000
# Saw: "Processing special column PSG for NNI" but NO PSG value logged
```

### After Fix:
```bash
npm run monitor
# Should see: "Using Growth Rate for PSG: 61 (source: CSV)"
# Should see: "PSG = ... = 0.0296"
```

## Files Changed

1. `src/app/stock-table-page.tsx`:
   - Extract Growth value from CSV
   - Pass to `getGestCalculationFromCsv`

2. `src/app/actions.ts`:
   - Add `growthValue` parameter to `getGestCalculationFromCsv`
   - Parse CSV Growth value
   - Prioritize CSV Growth over calculated growth for PSG
   - Fix scope issues in `getGestCalculation` function

3. `debug/` files:
   - `test-psg-calculation.ts`: Testing script
   - `check-nni-psg.ts`: NNI-specific testing script
   - `PSG_COLUMN_FIX.md`: Previous fix documentation
   - `PSG_CSV_GROWTH_FIX.md`: This document

## Deployment

- **Commit**: d83b2c5
- **Branch**: main
- **Status**: Pushed to GitHub, deploying to Vercel

## Related Issues

- **PSG Column Missing**: Fixed in commit 002c683 (column ordering bug)
- **PSG Calculation with Negative Growth**: Fixed in this commit (use CSV Growth)

## Notes

- The **GEst column still uses calculated growth** (PE/PEG) for consistency with the original calculation method
- Only **PSG uses CSV Growth** to ensure positive values when available
- **Fallback**: If CSV Growth is not available or is negative/zero, PSG will attempt to use calculated growth

