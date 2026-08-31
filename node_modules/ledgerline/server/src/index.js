import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { connectDB, syncIndexes } from './db.js';
import User from './models/User.js';
import Expense from './models/Expense.js';
import Category from './models/Category.js';
import Budget from './models/Budget.js';
import SettingsModel from './models/Settings.js';
import auth from './routes/auth.js';
import expenses from './routes/expenses.js';
import categories from './routes/categories.js';
import budgets from './routes/budgets.js';
import reports from './routes/reports.js';
import settings from './routes/settings.js';
import { requireAuth } from './middleware/requireAuth.js';
import { notFound, errorHandler } from './middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(',') || true,
    credentials: true, // the session rides in a cookie
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'ledgerline', time: new Date().toISOString() });
});

// Public: register, login, logout, and the "who am I" check.
app.use('/api/auth', auth);

// Everything below holds a person's money data. `requireAuth` sets req.userId,
// which every query in these routers filters by.
app.use('/api/expenses', requireAuth, expenses);
app.use('/api/categories', requireAuth, categories);
app.use('/api/budgets', requireAuth, budgets);
app.use('/api/reports', requireAuth, reports);
app.use('/api/settings', requireAuth, settings);

// In production the built client is served from the same origin.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;

connectDB(process.env.MONGODB_URI)
  .then(() => syncIndexes([User, Expense, Category, Budget, SettingsModel]))
  .then(() => {
    app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('[api] failed to start:', err.message);
    process.exit(1);
  });
