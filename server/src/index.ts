import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import gameRoutes from './routes/games';
import sessionRoutes from './routes/sessions';
import eventRoutes from './routes/events';
import clubRoutes from './routes/clubs';
import workspaceRoutes from './routes/workspace';
import messageRoutes from './routes/messages';
import reportRoutes from './routes/reports';
import teamRoutes from './routes/teams';
import collabRoutes from './routes/collab';
import { setupSocketHandlers } from './sockets';
import { errorHandler } from './middleware/errorHandler';
import { ensureAdminUser } from './lib/adminInit';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrl.split(',').map((s) => s.trim());

const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  if (allowedOrigins.some((o) => o.includes('vercel.app')) && origin.endsWith('.vercel.app')) {
    return callback(null, true);
  }
  if (allowedOrigins.some((o) => o.includes('netlify.app')) && origin.endsWith('.netlify.app')) {
    return callback(null, true);
  }
  return callback(null, false);
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ── Remove Express fingerprint ────────────────────────────────────────────────
app.disable('x-powered-by');

// ── Security Headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Legacy XSS filter (IE/older Chrome)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Strict referrer policy — no cross-origin leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Minimal browser permissions
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  // HSTS — effective once served over HTTPS / behind TLS-terminating proxy
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  next();
});

app.use(cors({ origin: corsOrigin, credentials: true }));

// ── Body parsing — hard cap at 2 mb ──────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Make io accessible to routes
app.set('io', io);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/collab', collabRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Socket handlers ───────────────────────────────────────────────────────────
setupSocketHandlers(io);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
  console.log(`\n🚀 TERMINAL server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🌐 CORS origins: ${rawClientUrl}\n`);
  await ensureAdminUser();
});

export { io };
