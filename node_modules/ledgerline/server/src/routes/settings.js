import { Router } from 'express';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

const WRITABLE = [
  'currencyCode',
  'currencySymbol',
  'currencyLabel',
  'monthStartsOn',
  'monthlyBudget',
  'rounding',
];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    res.json(settings.toObject());
  })
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const update = Object.fromEntries(
      WRITABLE.filter((k) => k in req.body).map((k) => [k, req.body[k]])
    );
    // Reminder toggles arrive one at a time from the Settings screen.
    if (req.body.reminders && typeof req.body.reminders === 'object') {
      for (const [k, v] of Object.entries(req.body.reminders)) {
        update[`reminders.${k}`] = Boolean(v);
      }
    }
    const settings = await Settings.findOneAndUpdate({ user: req.userId }, update, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });
    res.json(settings.toObject());
  })
);

export default router;
