import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Check if the request is for alexongeopol.vercel.app or any alexongeopol subdomain
  if (hostname.includes('alexongeopol.vercel.app') || 
      hostname.startsWith('alexongeopol-') ||
      hostname === 'alexongeopol.vercel.app') {
    // Rewrite to the alexon page
    if (request.nextUrl.pathname === '/') {
      return NextResponse.rewrite(new URL('/alexon', request.url));
    }
    // Also rewrite other paths to alexon if needed
    if (!request.nextUrl.pathname.startsWith('/api') && 
        !request.nextUrl.pathname.startsWith('/_next')) {
      return NextResponse.rewrite(new URL(`/alexon${request.nextUrl.pathname}`, request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

