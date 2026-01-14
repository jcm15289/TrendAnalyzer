#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== BUILDING PROJECT ==="
npm run build

if [ $? -eq 0 ]; then
    echo "=== BUILD SUCCESS ==="
    echo "=== DEPLOYING TO VERCEL ==="
    vercel --prod --yes
    echo "=== DEPLOYMENT COMPLETE ==="
else
    echo "=== BUILD FAILED ==="
    exit 1
fi

