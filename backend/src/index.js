import './config/env.js';
import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import authRoutes from './modules/auth/auth.route.js';
import userRoutes from './modules/user/user.route.js';
import jobRoutes from './modules/job/job.route.js';

const app = express();

// ─── Global Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Public Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Private Routes ─────────────────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);

// ─── Health Check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start Server ───────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

export default app;
