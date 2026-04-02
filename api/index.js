/**
 * Vercel Serverless Function — single entry for every HTTP request under /api/*
 *
 * How it works:
 * 1. vercel.json rewrites /api/auth/login, /api/auth/register, … → this function.
 * 2. This file exports the same Express app as local dev: ../backend/app.js
 * 3. That app mounts all routes: /api/auth, /api/users, /api/admin, …
 *
 * You do NOT add separate files per route here — that would duplicate backend code.
 * Login, signup, JWT, MongoDB, uploads (Cloudinary), etc. all run via backend/app.js.
 *
 * Required on Vercel (Project → Environment Variables): MONGODB_URI, JWT_SECRET,
 * JWT_REFRESH_SECRET, FRONTEND_URL, plus email/Cloudinary keys as in backend/.env
 */

const app = require('../backend/app');

module.exports = app;
