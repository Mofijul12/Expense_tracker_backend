import { Router } from 'express';
import Budget from '../models/Budget.js';
import Category from '../models/Category.js';
import Expense from '../models/Expense.js';
import Settings from '../models/Settings.js';
import { asyncHandler, HttpError } from '../middleware/asyncHandler.js';
import { parseMonth, monthRange, periodProgress } from '../lib/period.js';

const router = Router();

/** Where an envelope stands: the label the card shows top-right. */
function envelopeState(spent, limit, excluded) {
  if (limit <= 0) return 'No limit';
  if (spent > limit + 0.01) return 'Over';
  if (spent >= limit - 0.01) return excluded ? 'Done' : 'Fully spent';
  return 'On pace';
}

function envelopeNote(spent, limit, state, daysLeft, custom) {
  if (custom) return custom;
  if (state === 'Over') return `${Math.round(spent - limit)} over`;
  if (state === 'Fully spent' || state === 'Done') return 'Nothing left in this envelope';
  if (state === 'No limit') return 'No limit set';
  return `${Math.round(limit - spent)} left · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
}

/**
 * GET /api/budgets?month=YYYY-MM
 * The Budgets screen in one call: the overall envelope ring plus a card per
 * category with its limit, spend and pace.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    const month = parseMonth(req.query.month);
    const { start, end } = monthRange(month, settings.monthStartsOn);
    const progress = periodProgress(month, settings.monthStartsOn);

    const [categories, budgets, spendByCategory] = await Promise.all([
      Category.find({ user: req.userId }).sort({ order: 1, name: 1 }).lean(),
      Budget.find({ user: req.userId, month }).lean(),
      Expense.aggregate([
        { $match: { user: req.userId, date: { $gte: start, $lt: end } } },
        { $group: { _id: '$category', amount: { $sum: '$amount' } } },
      ]),
    ]);

    const limitByCategory = new Map(budgets.map((b) => [String(b.category), b]));
    const spentByCategory = new Map(spendByCategory.map((s) => [String(s._id), s.amount]));

    const items = categories.map((c) => {
      const budget = limitByCategory.get(String(c._id));
      const limit = budget?.limit ?? 0;
      const spent = spentByCategory.get(String(c._id)) || 0;
      const state = envelopeState(spent, limit, c.excludeFromSpend);
      return {
        _id: budget?._id || null,
        category: { _id: c._id, name: c.name, icon: c.icon, colorIndex: c.colorIndex },
        month,
        limit,
        spent,
        left: Math.max(limit - spent, 0),
        pct: limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0,
        rawPct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
        state,
        note: envelopeNote(spent, limit, state, progress.daysLeft, budget?.note),
        excludeFromSpend: c.excludeFromSpend,
      };
    });

    // The overall ring ignores categories kept out of spend (savings transfers)
    // but must still count expenses that have no category at all.
    const uncategorizedSpent = spentByCategory.get('null') || 0;
    const totalSpent =
      items.filter((i) => !i.excludeFromSpend).reduce((n, i) => n + i.spent, 0) +
      uncategorizedSpent;
    const monthlyBudget = settings.monthlyBudget;
    const perDaySoFar = progress.daysElapsed > 0 ? totalSpent / progress.daysElapsed : 0;
    const projected = Math.round(perDaySoFar * progress.totalDays);

    res.json({
      month,
      items,
      uncategorizedSpent,
      summary: {
        monthlyBudget,
        spent: totalSpent,
        left: monthlyBudget - totalSpent,
        pct: monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0,
        projected,
        pace: projected <= monthlyBudget ? 'under' : 'over',
        paceDelta: Math.abs(monthlyBudget - projected),
        safeDaily: progress.daysLeft > 0
          ? Math.round(Math.max(monthlyBudget - totalSpent, 0) / progress.daysLeft)
          : 0,
        ...progress,
      },
    });
  })
);

/**
 * PUT /api/budgets - upsert the whole month's envelopes in one go.
 * Body: { month, items: [{ category, limit, note }] }
 */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const month = parseMonth(req.body?.month);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) throw new HttpError(422, 'Send at least one envelope to save');

    const ops = items.map((item) => ({
      updateOne: {
        filter: { user: req.userId, month, category: item.category },
        update: {
          $setOnInsert: { user: req.userId },
          $set: {
            limit: Math.max(Number(item.limit) || 0, 0),
            ...(item.note !== undefined ? { note: item.note } : {}),
          },
        },
        upsert: true,
      },
    }));

    await Budget.bulkWrite(ops);
    const saved = await Budget.find({ user: req.userId, month }).populate('category', 'name icon colorIndex').lean();
    res.json({ month, items: saved });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const update = {};
    if ('limit' in req.body) update.limit = Math.max(Number(req.body.limit) || 0, 0);
    if ('note' in req.body) update.note = req.body.note;
    const budget = await Budget.findOneAndUpdate({ _id: req.params.id, user: req.userId }, update, {
      new: true,
      runValidators: true,
    }).populate('category', 'name icon colorIndex');
    if (!budget) throw new HttpError(404, 'Budget not found');
    res.json(budget);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!budget) throw new HttpError(404, 'Budget not found');
    res.json({ deleted: budget._id });
  })
);

export default router;
