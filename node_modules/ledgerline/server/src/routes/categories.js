import { Router } from 'express';
import Category from '../models/Category.js';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import { asyncHandler, HttpError } from '../middleware/asyncHandler.js';
import { parseMonth, monthRange } from '../lib/period.js';
import Settings from '../models/Settings.js';

const router = Router();

const WRITABLE = ['name', 'icon', 'colorIndex', 'rule', 'keywords', 'excludeFromSpend', 'order'];
const pick = (body) => Object.fromEntries(WRITABLE.filter((k) => k in body).map((k) => [k, body[k]]));

/** GET /api/categories — every category, with this month's spend and expense count. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load(req.userId);
    const month = parseMonth(req.query.month);
    const { start, end } = monthRange(month, settings.monthStartsOn);

    const [categories, totals] = await Promise.all([
      Category.find({ user: req.userId }).sort({ order: 1, name: 1 }).lean(),
      Expense.aggregate([
        { $match: { user: req.userId, date: { $gte: start, $lt: end } } },
        { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byId = new Map(totals.map((t) => [String(t._id), t]));
    const uncategorized = byId.get('null') || { amount: 0, count: 0 };

    res.json({
      month,
      items: categories.map((c) => {
        const t = byId.get(String(c._id)) || { amount: 0, count: 0 };
        return { ...c, amount: t.amount, count: t.count };
      }),
      uncategorized: { amount: uncategorized.amount, count: uncategorized.count },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const category = await Category.findOne({ _id: req.params.id, user: req.userId }).lean();
    if (!category) throw new HttpError(404, 'Category not found');
    res.json(category);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.body?.name) throw new HttpError(422, 'A category needs a name');
    const order = req.body.order ?? (await Category.countDocuments({ user: req.userId }));
    const category = await Category.create({ ...pick(req.body), order, user: req.userId });
    res.status(201).json(category);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const category = await Category.findOneAndUpdate({ _id: req.params.id, user: req.userId }, pick(req.body), {
      new: true,
      runValidators: true,
    });
    if (!category) throw new HttpError(404, 'Category not found');
    res.json(category);
  })
);

/** DELETE /api/categories/:id — expenses survive; they fall back to uncategorized. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const category = await Category.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!category) throw new HttpError(404, 'Category not found');
    const [{ modifiedCount }] = await Promise.all([
      Expense.updateMany({ user: req.userId, category: category._id }, { $set: { category: null } }),
      Budget.deleteMany({ user: req.userId, category: category._id }),
    ]);
    res.json({ deleted: category._id, expensesUncategorized: modifiedCount });
  })
);

export default router;
