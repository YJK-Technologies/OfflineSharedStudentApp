/**
 * Central Node.js & Express REST API Server
 * 
 * Provides:
 * - Direct Student CRUD REST Endpoints
 * - Offline Sync Push/Pull Endpoints
 * - Health check & diagnostic status
 * - CORS & Security headers
 * - JWT Authentication helper (optional per-request or global)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const { initDatabase } = require('./database');
const studentRoutes = require('./routes/studentRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'student_management_super_secure_jwt_secret_change_in_production_2026';

// 1. Initialize SQLite Database Schema
initDatabase();

// 2. CORS & Private Network Access Configuration
// Allows requests from React CRA dev server (3000), Electron (file:// or null origin), and Capacitor Android (http://localhost / capacitor://localhost)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use((req, res, next) => {
  // Required for newer Chromium / Android WebView accessing local LAN IP (192.168.x.x)
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, electron, native CapacitorHttp)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('https://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Dev-friendly permissive CORS
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Device-Id', 'ngrok-skip-browser-warning']
}));
app.options('*', cors());

// 3. Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Request Logging Middleware (Development)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[REST] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// 5. Optional JWT Authentication Middleware
// Can be toggled on by setting REQUIRE_AUTH=true in .env
function authenticateToken(req, res, next) {
  if (process.env.REQUIRE_AUTH !== 'true') {
    return next(); // Pass through in demo / beginner mode
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired authentication token' });
    }
    req.user = user;
    next();
  });
}

// 6. Health Check API
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'Offline-First Student Management Central Backend',
    database: 'SQLite (central_students.db)',
    syncEndpoints: {
      push: 'POST /api/sync/push',
      pull: 'GET /api/sync/pull'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.redirect('/health');
});

// 7. JWT Token Generation Endpoint (For testing & client credentials)
app.post('/api/auth/token', (req, res) => {
  const { deviceId, clientSecret } = req.body;
  const token = jwt.sign(
    { deviceId: deviceId || 'client_app', role: 'sync_client' },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
  );
  res.json({ success: true, token, expiresIn: '7d' });
});

// 8. Mount Student REST Endpoints (as specified in prompt)
// Supports root-level paths (/studentsInsert, /getStudents, /studentUpdate, /studentDelete)
app.use('/', studentRoutes);

// Also support /api/students for REST convention
app.use('/api/students', studentRoutes);

// 9. Mount Offline Sync Routes (/api/sync/push, /api/sync/pull)
app.use('/api/sync', syncRoutes);

// 10. Security: Explicitly Prevent Direct SQLite File Access
app.use((req, res, next) => {
  if (req.path.endsWith('.db') || req.path.endsWith('.sqlite')) {
    return res.status(403).json({ success: false, error: 'Access to raw database files is forbidden' });
  }
  next();
});

// 11. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// 12. Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// 13. Start HTTP Server
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Central SQLite Backend running on http://${HOST}:${PORT}`);
    console.log(`📡 Health Check: http://${HOST}:${PORT}/health`);
    console.log(`🔄 Push Sync:    POST http://${HOST}:${PORT}/api/sync/push`);
    console.log(`📥 Pull Sync:    GET  http://${HOST}:${PORT}/api/sync/pull`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
