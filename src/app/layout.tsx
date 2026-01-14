import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import { Toaster } from '@/components/ui/toaster';

const BUILD_TIMESTAMP =
  process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ||
  process.env.BUILD_TIMESTAMP ||
  new Date().toISOString();

export const metadata: Metadata = {
  title: 'Geopolitics Observatory',
  description: 'Track and analyze Google Trends for important keywords.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="geo-build-timestamp" content={BUILD_TIMESTAMP} />
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans')}>
        {children}
        <Toaster />
        <Script
          id="build-timestamp-bootstrap"
          strategy="beforeInteractive"
        >{`window.__BUILD_TIMESTAMP = '${BUILD_TIMESTAMP}';`}</Script>
        <Script
          id="google-trends-loader"
          strategy="afterInteractive"
          src="https://ssl.gstatic.com/trends_nrtr/3624_RC01/embed_loader.js"
        />
      </body>
    </html>
  );
}
