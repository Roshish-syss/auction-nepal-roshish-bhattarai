/**
 * MongoDB connection helper for the Vercel `api/` package (ESM).
 * Implementation lives in ../backend/db.js — this re-exports so you keep
 * one source of truth while still having api/db.js in this folder.
 *
 * Env: MONGODB_URI (preferred) or MONGO_URI (alias, same as many examples).
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { connectDB } = require('../backend/db.js');

export { connectDB };
