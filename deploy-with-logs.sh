#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get version and timestamp
VERSION=$(node -p "require('./package.json').version")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S %Z")

echo -e "${BLUE}🚀 DEPLOYMENT INFO:${NC}"
echo -e "Version: ${GREEN}$VERSION${NC}"
echo -e "Timestamp: ${GREEN}$TIMESTAMP${NC}"
echo "---"

# Check git status
echo -e "${BLUE}📋 Checking Git status...${NC}"
CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
    echo -e "${GREEN}Found changes:${NC}"
    git status --short
fi

# Stage all changes
echo -e "\n${BLUE}📦 Staging changes...${NC}"
git add -A
git status --short

# Commit
echo -e "\n${BLUE}💾 Committing changes...${NC}"
git commit -m "Deploy v$VERSION - $TIMESTAMP: Add stock API button with version tracking" || echo -e "${YELLOW}No new changes to commit${NC}"

# Push to GitHub
echo -e "\n${BLUE}📤 Pushing to GitHub...${NC}"
git push origin main || echo -e "${RED}Failed to push${NC}"

# Check Vercel status
echo -e "\n${BLUE}🔍 Checking Vercel status...${NC}"
vercel whoami || echo -e "${RED}Not logged into Vercel${NC}"

# Deploy to Vercel
echo -e "\n${BLUE}🚀 Deploying to Vercel...${NC}"
vercel --prod --yes || echo -e "${RED}Vercel deployment failed${NC}"

echo -e "\n${GREEN}✅ Deployment process complete!${NC}"
echo -e "Version: ${GREEN}$VERSION${NC}"
echo -e "Timestamp: ${GREEN}$TIMESTAMP${NC}"
echo ""
echo -e "${BLUE}Check deployment at:${NC} https://trends-analyzer.vercel.app"
echo -e "${BLUE}Vercel Dashboard:${NC} https://vercel.com/dashboard"
