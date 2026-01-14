# Update Vercel Environment Variables for 250MB Redis

## Important: Check Vercel Environment Variables

The code now **forces** use of the 250MB Redis DB, but if you have a `REDIS_URL` environment variable in Vercel pointing to the 25MB DB, you should update it.

## Steps:

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/julio-casals-projects/trend-analyzer/settings/environment-variables

2. **Check for REDIS_URL:**
   - Look for any of these environment variables:
     - `REDIS_URL`
     - `REDIS_CONNECTION_STRING`
     - `REDIS_TLS_URL`
     - `KV_URL`

3. **Update or Remove:**
   - If any of these point to `redis-18997` (25MB DB), either:
     - **Option A:** Update it to point to 250MB Redis:
       ```
       redis://default:3oXlvgRqAf5gGtWErDiLFlrBrMCAgTzO@redis-14969.c15.us-east-1-4.ec2.cloud.redislabs.com:14969
       ```
     - **Option B:** Remove it (the code will use the hardcoded 250MB DB)

4. **Redeploy:**
   - After updating, redeploy the project to apply changes

## Current Behavior:

The code will now:
- ✅ **Always use 250MB Redis DB** (redis-14969) as default
- ✅ **Ignore** environment variables pointing to 25MB DB
- ✅ **Filter out** metadata keys (ending with `:metadata`)
- ✅ **Show all trends** matching `cache-trends:Trends.*`

## Verify Connection:

After deployment, check the logs to confirm it's connecting to the 250MB DB:
- Look for: `🚦 Redis: Using 250MB Redis (redis-14969)`
