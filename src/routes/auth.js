import { Router } from 'express';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Settings from '../models/Settings.js';
import { asyncHandler, HttpError } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../lib/token.js';

const router = Router();

const MIN_PASSWORD = 8;

/** A starter set so a new account isn't staring at an empty Categories screen. */
const STARTER_CATEGORIES = [
  {
    name: 'Food & groceries',
    icon: 'ph ph-shopping-cart',
    colorIndex: 0,
    rule: 'Auto: grocer, market, cafe',
    keywords: ['grocer', 'market', 'cafe', 'restaurant', 'bakery'],
    order: 0,
  },
  {
    name: 'Rent & bills',
    icon: 'ph ph-house-line',
    colorIndex: 1,
    rule: 'Auto: rent, internet, electric',
    keywords: ['rent', 'internet', 'electric', 'water', 'gas'],
    order: 1,
  },
  {
    name: 'Transport',
    icon: 'ph ph-bus',
    colorIndex: 2,
    rule: 'Auto: uber, metro, fuel',
    keywords: ['uber', 'metro', 'fuel', 'taxi', 'bus'],
    order: 2,
  },
  { name: 'Health', icon: 'ph ph-heartbeat', colorIndex: 3, rule: 'No rule', order: 3 },
  { name: 'Leisure', icon: 'ph ph-popcorn', colorIndex: 4, rule: 'No rule', order: 4 },
];

/** POST /api/auth/register */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name) throw new HttpError(422, 'Tell us your name');
    if (!email) throw new HttpError(422, 'An email address is required');
    if (password.length < MIN_PASSWORD) {
      throw new HttpError(422, `Use at least ${MIN_PASSWORD} characters for your password`);
    }

    if (await User.exists({ email })) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
      lastLoginAt: new Date(),
    });

    // Give the new account something to work with.
    await Promise.all([
      Category.insertMany(STARTER_CATEGORIES.map((c) => ({ ...c, user: user._id }))),
      Settings.load(user._id),
    ]);

    setAuthCookie(res, signToken(user._id));
    res.status(201).json({ user: user.toPublic() });
  })
);

/** POST /api/auth/login */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) throw new HttpError(422, 'Enter your email and password');

    const user = await User.findOne({ email }).select('+passwordHash');
    // One message for both cases, so this can't be used to discover which
    // email addresses have accounts.
    const ok = user && (await user.checkPassword(password));
    if (!ok) throw new HttpError(401, 'That email and password do not match');

    user.lastLoginAt = new Date();
    await user.save();

    setAuthCookie(res, signToken(user._id));
    res.json({ user: user.toPublic() });
  })
);

/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/** GET /api/auth/me — who the current cookie belongs to. */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toPublic() });
  })
);

export default router;
