import './config/env.js';
import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import authRoutes from './modules/auth/auth.route.js';
import userRoutes from './modules/user/user.route.js';
import jobRoutes from './modules/job/job.route.js';
import errorHandler from './middleware/error.middleware.js';

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

// ─── Error Handler (must be last) ───────────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

export default app;
