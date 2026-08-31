import { Router } from 'express';
import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import Settings from '../models/Settings.js';
import { asyncHandler, HttpError } from '../middleware/asyncHandler.js';
import { parseMonth, monthRange } from '../lib/period.js';

const router = Router();

const WRITABLE = ['date', 'amount', 'category', 'note', 'tags'];

function pick(body) {
  const out = Object.fromEntries(WRITABLE.filter((k) => k in body).map((k) => [k, body[k]]));
  if ('category' in out && !out.category) out.category = null;
  if ('date' in out && out.date) out.date = new Date(out.date);
  if ('amount' in out) out.amount = Number(out.amount);
  return out;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Reject a category id that belongs to somebody else's account. */
async function assertOwnCategory(categoryId, userId) {
  if (!categoryId) return;
  const owned = await Category.exists({ _id: categoryId, user: userId });
  if (!owned) throw new HttpError(422, 'That category does not exist on your account');
}

/**
 * Match the note against each category's keywords so a new row can land in a
 * bucket on its own. The note is the only free text an expense carries.
 */
async function autoCategorize(note, userId) {
  if (!note) return null;
  const haystack = note.toLowerCase();
  const categories = await Category.find({ user: userId, keywords: { $ne: [] } })
    .sort({ order: 1 })
    .lean();
  const hit = categories.find((c) =>
    c.keywords.some((k) => k && haystack.includes(k.toLowerCase()))
  );
  return hit ? hit._id : null;
}

/** Turn the query string into a Mongo filter plus the resolved period. */
async function buildQuery(query, userId) {
  const settings = await Settings.load(userId);
  const month = parseMonth(query.month);
  // Every list starts scoped to the signed-in account.
  const filter = { user: userId };

  if (query.month !== 'all') {
    const { start, end } = monthRange(month, settings.monthStartsOn);
    filter.date = { $gte: start, $lt: end };
  }

  switch (query.filter) {
    case 'uncategorized':
      filter.category = null;
      break;
    default:
      break;
  }

  if (query.category && mongoose.isValidObjectId(query.category)) filter.category = query.category;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ note: rx }, { tags: rx }];
  }
  if (query.minAmount) filter.amount = { ...filter.amount, $gte: Number(query.minAmount) };
  if (query.maxAmount) filter.amount = { ...filter.amount, $lte: Number(query.maxAmount) };

  return { filter, month, settings };
}

const SORTS = {
  'date-desc': { date: -1, createdAt: -1 },
  'date-asc': { date: 1, createdAt: 1 },
  'amount-desc': { amount: -1 },
  'amount-asc': { amount: 1 },
};

/**
 * GET /api/expenses
 * Paginated list for the Expenses screen. Returns the page plus the totals the
 * toolbar shows ("42 expenses - 48,320 total") for the whole filtered set.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, month } = await buildQuery(req.query, req.userId);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 200);
    const sort = SORTS[req.query.sort] || SORTS['date-desc'];

    // Savings transfers are listed like any other row but are not "spend", so
    // the toolbar total lines up with the figure the Overview screen shows.
    const excluded = await Category.find({ user: req.userId, excludeFromSpend: true }).select('_id').lean();
    const excludedIds = excluded.map((c) => c._id);
    // When the caller already pinned a category, honour that instead - they
    // asked for that bucket, savings included.
    const spendFilter =
      excludedIds.length && !('category' in filter)
        ? { ...filter, category: { $nin: excludedIds } }
        : filter;

    const [items, total, totals, spendTotals] = await Promise.all([
      Expense.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('category', 'name icon colorIndex')
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([
        { $match: filter },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: spendFilter },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      items,
      month,
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
      totalAmount: totals[0]?.amount || 0,
      spendAmount: spendTotals[0]?.amount || 0,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.userId })
      .populate('category', 'name icon colorIndex')
      .lean();
    if (!expense) throw new HttpError(404, 'Expense not found');
    res.json(expense);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pick(req.body);
    if (!(data.amount > 0)) throw new HttpError(422, 'An expense needs an amount above zero');
    if (!data.category) data.category = await autoCategorize(data.note, req.userId);
    else await assertOwnCategory(data.category, req.userId);

    const created = await Expense.create({
      ...data,
      user: req.userId,
      history: [{ what: 'Created', when: new Date() }],
    });
    await created.populate('category', 'name icon colorIndex');
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await Expense.findOne({ _id: req.params.id, user: req.userId });
    if (!existing) throw new HttpError(404, 'Expense not found');

    const data = pick(req.body);
    const entries = [];
    if ('amount' in data && data.amount !== existing.amount) entries.push('Amount updated');
    if ('category' in data && String(data.category) !== String(existing.category)) {
      if (data.category) await assertOwnCategory(data.category, req.userId);
      const next = data.category
        ? await Category.findOne({ _id: data.category, user: req.userId }).lean()
        : null;
      entries.push(`Category changed to ${next ? next.name : 'Uncategorized'}`);
    }
    if ('note' in data && data.note !== existing.note) {
      entries.push(existing.note ? 'Note edited' : 'Note added');
    }

    existing.set(data);
    for (const what of entries) existing.history.push({ what, when: new Date() });
    await existing.save();
    await existing.populate('category', 'name icon colorIndex');
    res.json(existing);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!expense) throw new HttpError(404, 'Expense not found');
    res.json({ deleted: expense._id });
  })
);

/** POST /api/expenses/:id/duplicate - the Duplicate button on the detail screen. */
router.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const source = await Expense.findOne({ _id: req.params.id, user: req.userId }).lean();
    if (!source) throw new HttpError(404, 'Expense not found');

    const { _id, createdAt, updatedAt, history, ...rest } = source;
    const copy = await Expense.create({
      ...rest,
      user: req.userId,
      date: req.body?.date ? new Date(req.body.date) : new Date(),
      history: [{ what: 'Duplicated from an earlier expense', when: new Date() }],
    });
    await copy.populate('category', 'name icon colorIndex');
    res.status(201).json(copy);
  })
);

/**
 * POST /api/expenses/:id/split
 * Body: { parts: [{ amount, category, note }] }. The parts must add up to the
 * original amount; the original is replaced by the parts.
 */
router.post(
  '/:id/split',
  asyncHandler(async (req, res) => {
    const source = await Expense.findOne({ _id: req.params.id, user: req.userId }).lean();
    if (!source) throw new HttpError(404, 'Expense not found');

    const parts = Array.isArray(req.body?.parts) ? req.body.parts : [];
    if (parts.length < 2) throw new HttpError(422, 'A split needs at least two parts');

    for (const part of parts) await assertOwnCategory(part.category, req.userId);

    const sum = parts.reduce((n, p) => n + Number(p.amount || 0), 0);
    if (Math.abs(sum - source.amount) > 0.01) {
      throw new HttpError(422, `Parts add up to ${sum}, but the expense is ${source.amount}`);
    }

    const created = await Expense.insertMany(
      parts.map((p) => ({
        user: req.userId,
        date: source.date,
        amount: Number(p.amount),
        category: p.category || source.category || null,
        note: p.note || source.note,
        tags: source.tags,
        splitFrom: source._id,
        history: [{ what: 'Split from a larger expense', when: new Date() }],
      }))
    );

    await Expense.findOneAndDelete({ _id: source._id, user: req.userId });
    res.status(201).json({ replaced: source._id, items: created });
  })
);

export default router;
