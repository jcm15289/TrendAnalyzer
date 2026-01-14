export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background text-center text-muted-foreground">
      <h2 className="text-2xl font-semibold text-foreground">Page not found</h2>
      <p className="max-w-sm text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. Use the navigation to continue
        exploring GeoPolGTrends.
      </p>
    </div>
  );
}

