import { CorsOptions } from 'cors';

export const DEFAULT_PRODUCTION_ORIGIN = 'https://terminal-two-gilt.vercel.app';

export const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

/**
 * Parses and validates configured origins from CLIENT_URL and defaults.
 */
export function resolveAllowedOrigins(rawEnvClientUrl?: string): {
  allowedOrigins: string[];
  rawClientUrl: string;
} {
  const envVal = rawEnvClientUrl !== undefined ? rawEnvClientUrl : process.env.CLIENT_URL;
  const rawClientUrl = envVal || DEFAULT_DEV_ORIGINS[0];

  const originsSet = new Set<string>();

  // Always include the official production frontend
  originsSet.add(DEFAULT_PRODUCTION_ORIGIN);

  // Always include standard local dev origins
  DEFAULT_DEV_ORIGINS.forEach((o) => originsSet.add(o));

  // Parse comma-separated CLIENT_URL if provided
  if (envVal) {
    const parsed = envVal
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter((s) => s.length > 0 && s !== '*');

    for (const origin of parsed) {
      try {
        const url = new URL(origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          originsSet.add(url.origin);
        } else {
          console.warn(`[CORS] Ignoring invalid protocol in CLIENT_URL: ${origin}`);
        }
      } catch {
        console.warn(`[CORS] Ignoring malformed URL in CLIENT_URL: ${origin}`);
      }
    }
  }

  return {
    allowedOrigins: Array.from(originsSet),
    rawClientUrl,
  };
}

/**
 * Checks whether an incoming origin is permitted.
 */
export function isOriginAllowed(origin: string | undefined, allowedOriginsList: string[]): boolean {
  // Allow non-browser requests (same-origin, curl, server-to-server, health checks)
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '');
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Exact match in explicit allowed origins
  if (allowedOriginsList.includes(normalized)) {
    return true;
  }

  // 2. Any local development address (localhost / 127.0.0.1 on any port)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }

  // 3. Official Vercel production & branch preview deployments for TERMINAL
  if (/^https:\/\/terminal-two-gilt(-[a-z0-9-]+)?\.vercel\.app$/i.test(normalized)) {
    return true;
  }

  // 4. Non-production development tunnels
  if (!isProd) {
    if (
      normalized.endsWith('.devtunnels.ms') ||
      normalized.endsWith('.app.github.dev') ||
      normalized.endsWith('.trycloudflare.com') ||
      normalized.endsWith('.ngrok-free.app') ||
      normalized.endsWith('.ngrok.app')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Creates the cors callback function for Express and Socket.IO.
 */
export function createCorsOrigin(allowedOriginsList: string[]) {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (isOriginAllowed(origin, allowedOriginsList)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  };
}

export function getCorsOptions(allowedOriginsList: string[]): CorsOptions {
  return {
    origin: createCorsOrigin(allowedOriginsList),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
}
