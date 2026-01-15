#!/bin/bash
set -e

echo "🔗 Fixing Vercel alias..."
echo "Setting trends-analyzer.vercel.app → trend-analyzer-p792j4559-julio-casals-projects.vercel.app"
echo ""

# Method 1: Use vercel alias command
vercel alias set trend-analyzer-p792j4559-julio-casals-projects.vercel.app trends-analyzer.vercel.app --yes

echo ""
echo "✅ Alias set!"
echo "Check: https://trends-analyzer.vercel.app"
