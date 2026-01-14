# TrendAnalyzer

A Next.js application for analyzing and visualizing trends data.

## Project Setup

This project is configured to deploy to Vercel as a separate instance from `geopol-gtrends`.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:9002](http://localhost:9002) in your browser.

## Deployment

See [DEPLOY_TRENDANALYZER.md](./DEPLOY_TRENDANALYZER.md) for detailed deployment instructions.

Quick deploy:
```bash
./deploy-trendanalyzer.sh
```

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components
- `src/lib/` - Utility libraries and helpers
- `public/` - Static assets

## Important Notes

- This is a **separate deployment** from `geopol-gtrends`
- Uses independent Vercel project: `TrendAnalyzer`
- Uses independent Git repository
- Environment variables should be configured separately in Vercel
