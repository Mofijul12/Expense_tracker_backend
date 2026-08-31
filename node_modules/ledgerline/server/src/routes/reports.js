import { Router } from 'express';
import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  parseMonth,
  monthRange,
  periodProgress,
  lastMonths,
  shiftMonth,
  shortMonthLabel,
  monthLabel,
} from '../lib/period.js';

const router = Router();

/** Categories kept out of spend totals, e.g. a savings transfer. */
async function excludedCategoryIds(userId) {
  const excluded = await Category.find({ user: userId, excludeFromSpend: true })
    .select('_id')
    .lean();
  return excluded.map((c) => c._id);
}

function spendMatch(userId, start, end, excludedIds) {
  const match = { user: userId, date: { $gte: start, $lt: end } };
  if (excludedIds.length) match.category = { $nin: excludedIds };
  return match;
}

/** Total spend for one period, savings excluded. */
async function monthTotal(userId, month, monthStartsOn, excludedIds) {
  const { start, end } = monthRange(month, monthStartsOn);
  const [row] = await Expense.aggregate([
    { $match: spendMatch(userId, start, end, excludedIds) },
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return { month, amount: row?.amount || 0, count: row?.count || 0 };
}

/** Per-category totals for one period. */
async function categoryTotals(userId, month, monthStartsOn) {
  const { start, end } = monthRange(month, monthStartsOn);
  const rows = await Expense.aggregate([
    { $match: { user: userId, date: { $gte: start, $lt: end } } },
    { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

/**
 * GET /api/reports/trend?month=&months=6
 * Spend per month for the trend chart, with the budget line the chart draws.
 */
router.get(
  '/trend',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    const month = parseMonth(req.query.month);
    const count = Math.min(Math.max(Number(req.query.months) || 6, 2), 24);
    const excludedIds = await excludedCategoryIds(req.userId);

    const months = lastMonths(month, count);
    const totals = await Promise.all(
      months.map((m) => monthTotal(req.userId, m, settings.monthStartsOn, excludedIds))
    );

    res.json({
      budget: settings.monthlyBudget,
      points: totals.map((t) => ({
        month: t.month,
        label: shortMonthLabel(t.month),
        amount: t.amount,
        count: t.count,
      })),
    });
  })
);

/**
 * GET /api/reports/daily?month=
 * One bar per day of the period, weekends flagged so the chart can tint them.
 */
router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    const month = parseMonth(req.query.month);
    const { start, end } = monthRange(month, settings.monthStartsOn);
    const excludedIds = await excludedCategoryIds(req.userId);

    const rows = await Expense.aggregate([
      { $match: spendMatch(req.userId, start, end, excludedIds) },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
          amount: { $sum: '$amount' },
        },
      },
    ]);
    const byDay = new Map(rows.map((r) => [r._id, r.amount]));

    const days = [];
    let weekendTotal = 0;
    let total = 0;
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
      const weekend = dow === 5 || dow === 6; // Fri-Sat weekend
      const amount = byDay.get(key) || 0;
      total += amount;
      if (weekend) weekendTotal += amount;
      days.push({ date: key, day: d.getUTCDate(), weekend, amount });
    }

    res.json({
      month,
      days,
      total,
      weekendShare: total > 0 ? Math.round((weekendTotal / total) * 100) : 0,
    });
  })
);

/**
 * GET /api/reports/mix?month=
 * Category share of the month for the donut and the "Where it went" bars.
 */
router.get(
  '/mix',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    const month = parseMonth(req.query.month);
    const [categories, totals] = await Promise.all([
      Category.find({ user: req.userId, excludeFromSpend: false }).sort({ order: 1, name: 1 }).lean(),
      categoryTotals(req.userId, month, settings.monthStartsOn),
    ]);

    const items = categories
      .map((c) => {
        const row = totals.get(String(c._id));
        return {
          _id: c._id,
          name: c.name,
          icon: c.icon,
          colorIndex: c.colorIndex,
          amount: row?.amount || 0,
          count: row?.count || 0,
        };
      })
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Expenses with no category still belong in the mix, or the shares would
    // be taken against a total smaller than the month's real spend.
    const loose = totals.get('null');
    if (loose?.amount > 0) {
      items.push({
        _id: null,
        name: 'Uncategorized',
        icon: 'ph ph-question',
        colorIndex: 4,
        amount: loose.amount,
        count: loose.count,
      });
    }

    const total = items.reduce((n, i) => n + i.amount, 0);
    res.json({
      month,
      total,
      items: items.map((i) => ({ ...i, pct: total > 0 ? Math.round((i.amount / total) * 100) : 0 })),
    });
  })
);

/**
 * GET /api/reports/movers?month=
 * This period against the one before it, per category, biggest change first.
 */
router.get(
  '/movers',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    const month = parseMonth(req.query.month);
    const previous = shiftMonth(month, -1);

    const [categories, current, prior] = await Promise.all([
      Category.find({ user: req.userId }).sort({ order: 1, name: 1 }).lean(),
      categoryTotals(req.userId, month, settings.monthStartsOn),
      categoryTotals(req.userId, previous, settings.monthStartsOn),
    ]);

    const items = categories
      .map((c) => {
        const now = current.get(String(c._id))?.amount || 0;
        const before = prior.get(String(c._id))?.amount || 0;
        const pct = before > 0 ? Math.round(((now - before) / before) * 100) : now > 0 ? 100 : 0;
        return {
          _id: c._id,
          name: c.name,
          icon: c.icon,
          previous: before,
          current: now,
          change: now - before,
          pct,
          direction: now === before ? 'flat' : now > before ? 'up' : 'down',
        };
      })
      .filter((i) => i.current > 0 || i.previous > 0)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    res.json({ month, previous, previousLabel: monthLabel(previous), items });
  })
);

/**
 * GET /api/reports/overview?month=
 * Everything the Overview screen needs: the four stat tiles, the trend, the
 * category split and the five most recent expenses.
 */
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    const month = parseMonth(req.query.month);
    const previous = shiftMonth(month, -1);
    const { start, end } = monthRange(month, settings.monthStartsOn);
    const progress = periodProgress(month, settings.monthStartsOn);
    const excludedIds = await excludedCategoryIds(req.userId);

    const [thisMonth, priorMonth, largest, recent, allCount] = await Promise.all([
      monthTotal(req.userId, month, settings.monthStartsOn, excludedIds),
      monthTotal(req.userId, previous, settings.monthStartsOn, excludedIds),
      Expense.findOne(spendMatch(req.userId, start, end, excludedIds))
        .sort({ amount: -1 })
        .populate('category', 'name icon colorIndex')
        .lean(),
      Expense.find({ user: req.userId, date: { $gte: start, $lt: end } })
        .sort({ date: -1, createdAt: -1 })
        .limit(5)
        .populate('category', 'name icon colorIndex')
        .lean(),
      Expense.countDocuments({ user: req.userId, date: { $gte: start, $lt: end } }),
    ]);

    const spent = thisMonth.amount;
    const budget = settings.monthlyBudget;
    const left = budget - spent;
    const dailyAverage = progress.daysElapsed > 0 ? Math.round(spent / progress.daysElapsed) : 0;
    const priorProgress = periodProgress(previous, settings.monthStartsOn, monthRange(previous, settings.monthStartsOn).end);
    const priorDaily = priorProgress.totalDays > 0 ? Math.round(priorMonth.amount / priorProgress.totalDays) : 0;

    res.json({
      month,
      monthLabel: monthLabel(month),
      expenseCount: allCount,
      progress,
      stats: {
        spent: {
          value: spent,
          budget,
          pctOfBudget: budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0,
          daysLeft: progress.daysLeft,
        },
        left: {
          value: left,
          safeDaily: progress.daysLeft > 0 ? Math.round(Math.max(left, 0) / progress.daysLeft) : 0,
        },
        dailyAverage: {
          value: dailyAverage,
          previous: priorDaily,
          change: dailyAverage - priorDaily,
        },
        largest: largest
          ? {
              value: largest.amount,
              note: largest.note || '',
              category: largest.category?.name || 'Uncategorized',
              id: largest._id,
            }
          : null,
      },
      change: {
        previousMonth: previous,
        previousLabel: shortMonthLabel(previous),
        previousAmount: priorMonth.amount,
        pct:
          priorMonth.amount > 0
            ? Math.round(((spent - priorMonth.amount) / priorMonth.amount) * 1000) / 10
            : 0,
      },
      recent,
    });
  })
);

export default router;
