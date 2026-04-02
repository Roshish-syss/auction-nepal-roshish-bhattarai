/**
 * Vercel serverless entry (ESM).
 * All REST routes (auth, signup, admin, …) come from ../backend/app.js (Express, CommonJS).
 * Socket.IO is not available here — use backend/server.js locally or a separate host for websockets.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// mongoose bufferCommands is set in ../backend/db.js before connect

// Single Express app shared with local API (backend/app.js)
const app = require('../backend/app.js');

export default app;
