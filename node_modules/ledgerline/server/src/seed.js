/**
 * Seeds a demo account with a coherent six-month history so every screen has
 * something real to render. Safe to re-run, and it only ever touches the demo
 * account — other people's data is left alone.
 *
 *   npm run seed
 *
 * Everything is attached to a demo account you can sign in as:
 *   demo@ledgerline.app / demo1234
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, syncIndexes } from './db.js';
import Category from './models/Category.js';
import Expense from './models/Expense.js';
import Budget from './models/Budget.js';
import Settings from './models/Settings.js';
import User from './models/User.js';

const CATEGORIES = [
  {
    name: 'Food & groceries',
    icon: 'ph ph-shopping-cart',
    colorIndex: 0,
    rule: 'Auto: grocers, tea, produce',
    keywords: ['grocer', 'tea', 'produce', 'bakery', 'fish', 'bazaar'],
    order: 0,
  },
  {
    name: 'Rent & bills',
    icon: 'ph ph-house-line',
    colorIndex: 1,
    rule: 'Auto: rent, internet, utilities',
    keywords: ['apartment', 'internet', 'power', 'water', 'gas', 'rent'],
    order: 1,
  },
  {
    name: 'Transport',
    icon: 'ph ph-bus',
    colorIndex: 2,
    rule: 'Auto: ridehail, metro pass',
    keywords: ['ridehail', 'metro', 'cng', 'fuel', 'bus'],
    order: 2,
  },
  { name: 'Health', icon: 'ph ph-heartbeat', colorIndex: 3, rule: 'No rule', order: 3 },
  { name: 'Leisure', icon: 'ph ph-popcorn', colorIndex: 4, rule: 'No rule', order: 4 },
  {
    name: 'Savings',
    icon: 'ph ph-piggy-bank',
    colorIndex: 1,
    rule: 'Excluded from spend',
    keywords: ['savings transfer'],
    excludeFromSpend: true,
    order: 5,
  },
  { name: 'Gifts', icon: 'ph ph-gift', colorIndex: 4, rule: 'No rule', order: 6 },
  { name: 'Education', icon: 'ph ph-graduation-cap', colorIndex: 2, rule: 'No rule', order: 7 },
];

const BUDGET_LIMITS = {
  'Food & groceries': 19500,
  'Rent & bills': 18000,
  Transport: 6000,
  Health: 5000,
  Leisure: 6500,
  Savings: 5000,
  Gifts: 2000,
  Education: 3000,
};

const DEMO = { name: 'Demo account', email: 'demo@ledgerline.app', password: 'demo1234' };

const day = (y, m, d, hh = 12, mm = 0) => new Date(Date.UTC(y, m - 1, d, hh, mm));

/** August 2026, written out by hand: 41 spend rows totalling 48,320 plus one savings transfer. */
const AUGUST = [
  // Food & groceries - 14 rows, 14,180
  { d: 27, merchant: 'Northline Grocers', amount: 2180, cat: 'Food & groceries', note: 'Weekly run' },
  { d: 26, merchant: 'Corner Tea Stall', amount: 120, cat: 'Food & groceries' },
  { d: 24, merchant: 'Greenway Produce', amount: 520, cat: 'Food & groceries' },
  { d: 23, merchant: 'Corner Tea Stall', amount: 140, cat: 'Food & groceries' },
  { d: 21, merchant: 'Northline Grocers', amount: 1960, cat: 'Food & groceries', note: 'Weekly run' },
  { d: 20, merchant: 'Spice Bazaar', amount: 780, cat: 'Food & groceries' },
  { d: 18, merchant: 'Greenway Produce', amount: 640, cat: 'Food & groceries' },
  { d: 17, merchant: 'Corner Tea Stall', amount: 110, cat: 'Food & groceries' },
  { d: 15, merchant: 'Northline Grocers', amount: 2240, cat: 'Food & groceries', note: 'Weekly run' },
  { d: 13, merchant: 'Fresh Catch Fish', amount: 1150, cat: 'Food & groceries' },
  { d: 11, merchant: 'Corner Tea Stall', amount: 130, cat: 'Food & groceries' },
  { d: 9, merchant: 'Northline Grocers', amount: 2060, cat: 'Food & groceries', note: 'Weekly run' },
  { d: 6, merchant: 'Greenway Produce', amount: 590, cat: 'Food & groceries' },
  { d: 3, merchant: 'Bakery on Fifth', amount: 1560, cat: 'Food & groceries', note: 'Eid sweets' },

  // Rent & bills - 4 rows, 18,000
  { d: 20, merchant: 'Hillside Apartments', amount: 14000, cat: 'Rent & bills', note: 'August rent' },
  { d: 24, merchant: 'Fiberline Internet', amount: 1500, cat: 'Rent & bills' },
  { d: 12, merchant: 'City Power & Water', amount: 1900, cat: 'Rent & bills' },
  { d: 8, merchant: 'GasLine Utility', amount: 600, cat: 'Rent & bills' },

  // Transport - 9 rows, 6,900
  { d: 26, merchant: 'Metro Pass top-up', amount: 900, cat: 'Transport' },
  { d: 21, merchant: 'Ridehail - airport', amount: 1340, cat: 'Transport', note: 'Work trip' },
  { d: 19, merchant: 'Ridehail - city', amount: 420, cat: 'Transport' },
  { d: 16, merchant: 'CNG auto fare', amount: 260, cat: 'Transport' },
  { d: 14, merchant: 'Ridehail - city', amount: 380, cat: 'Transport' },
  { d: 10, merchant: 'Fuel - Shell', amount: 2200, cat: 'Transport' },
  { d: 7, merchant: 'CNG auto fare', amount: 240, cat: 'Transport' },
  { d: 5, merchant: 'Ridehail - city', amount: 460, cat: 'Transport' },
  { d: 2, merchant: 'Bus fare card', amount: 700, cat: 'Transport' },

  // Health - 3 rows, 3,200
  { d: 25, merchant: 'Riverside Pharmacy', amount: 640, cat: 'Health' },
  { d: 14, merchant: 'Dr. Rahman consult', amount: 1200, cat: 'Health' },
  { d: 4, merchant: 'Riverside Pharmacy', amount: 1360, cat: 'Health' },

  // Leisure - 6 rows, 3,820
  { d: 22, merchant: 'Lantern Cinema', amount: 860, cat: 'Leisure', note: 'Two tickets' },
  { d: 19, merchant: 'Paperbound Books', amount: 780, cat: 'Leisure' },
  { d: 16, merchant: 'Rooftop Cafe', amount: 640, cat: 'Leisure' },
  { d: 12, merchant: 'Streaming subscription', amount: 450, cat: 'Leisure' },
  { d: 9, merchant: 'Riverwalk Concert', amount: 700, cat: 'Leisure' },
  { d: 5, merchant: 'Arcade Night', amount: 390, cat: 'Leisure' },

  // Gifts - 2 rows, 1,400
  { d: 18, merchant: 'Petal & Stem Florist', amount: 650, cat: 'Gifts' },
  { d: 11, merchant: 'Gift Loft', amount: 750, cat: 'Gifts' },

  // Education - 1 row, 500
  { d: 6, merchant: 'Online course - SQL', amount: 500, cat: 'Education' },

  // Uncategorized - 2 rows, 320
  { d: 25, merchant: 'Unknown POS 9821', amount: 180, cat: null },
  { d: 15, merchant: 'ATM withdrawal fee', amount: 140, cat: null },

  // Kept out of spend totals
  { d: 1, merchant: 'Savings transfer', amount: 5000, cat: 'Savings', note: 'Auto-moved on the 1st' },
];

/** Per-category totals for the five months before August, matching the trend chart. */
const HISTORY = {
  '2026-07': { 'Rent & bills': 18000, 'Food & groceries': 15800, Transport: 4200, Health: 4150, Leisure: 2100 },
  '2026-06': { 'Rent & bills': 18000, 'Food & groceries': 17500, Transport: 7300, Health: 3900, Leisure: 4300 },
  '2026-05': { 'Rent & bills': 17500, 'Food & groceries': 11200, Transport: 3600, Health: 1400, Leisure: 1700 },
  '2026-04': { 'Rent & bills': 17500, 'Food & groceries': 14600, Transport: 5200, Health: 2300, Leisure: 2500 },
  '2026-03': { 'Rent & bills': 17500, 'Food & groceries': 13400, Transport: 3900, Health: 1600, Leisure: 1800 },
};

const ROW_COUNTS = {
  'Rent & bills': 4,
  'Food & groceries': 12,
  Transport: 7,
  Health: 3,
  Leisure: 5,
};

// Descriptive notes for the generated back-months.
const NOTE_POOL = {
  'Food & groceries': ['Northline Grocers', 'Greenway Produce', 'Corner Tea Stall', 'Spice Bazaar', 'Fresh Catch Fish', 'Bakery on Fifth'],
  'Rent & bills': ['Hillside Apartments', 'Fiberline Internet', 'City Power & Water', 'GasLine Utility'],
  Transport: ['Ridehail - city', 'Metro Pass top-up', 'CNG auto fare', 'Fuel - Shell', 'Bus fare card'],
  Health: ['Riverside Pharmacy', 'Dr. Rahman consult', 'Lakeview Diagnostics'],
  Leisure: ['Lantern Cinema', 'Paperbound Books', 'Rooftop Cafe', 'Streaming subscription', 'Arcade Night'],
};

/** Split a total into `count` amounts that still add up exactly. */
function spread(total, count, seed) {
  const weights = Array.from(
    { length: count },
    (_, i) => 0.55 + ((Math.sin((seed + i * 7.13) * 12.9898) + 1) / 2) * 0.9
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => Math.max(60, Math.round((total * w) / sum / 10) * 10));
  const drift = total - amounts.reduce((a, b) => a + b, 0);
  const biggest = amounts.indexOf(Math.max(...amounts));
  amounts[biggest] += drift;
  return amounts;
}

function buildHistoryRows(month, catByName) {
  const [year, m] = month.split('-').map(Number);
  const rows = [];
  let seed = year + m;

  for (const [catName, total] of Object.entries(HISTORY[month])) {
    const count = ROW_COUNTS[catName];
    const notes = NOTE_POOL[catName];

    if (catName === 'Rent & bills') {
      // Rent is one big fixed row plus the utilities.
      const rent = 14000;
      const rest = spread(total - rent, count - 1, seed++);
      rows.push({
        date: day(year, m, 20),
        amount: rent,
        category: catByName.get(catName),
        note: 'Monthly rent',
      });
      rest.forEach((amount, i) => {
        rows.push({
          date: day(year, m, 8 + i * 5),
          amount,
          category: catByName.get(catName),
          note: notes[i + 1] || notes[notes.length - 1],
        });
      });
      continue;
    }

    spread(total, count, seed++).forEach((amount, i) => {
      rows.push({
        date: day(year, m, Math.min(28, 2 + Math.floor((i * 27) / count))),
        amount,
        category: catByName.get(catName),
        note: notes[i % notes.length],
      });
    });
  }

  // The savings transfer runs every month and stays out of the spend totals.
  rows.push({
    date: day(year, m, 1),
    amount: 5000,
    category: catByName.get('Savings'),
    note: 'Auto-moved on the 1st',
  });

  return rows;
}

async function run() {
  await connectDB(process.env.MONGODB_URI);
  await syncIndexes([User, Expense, Category, Budget, Settings]);

  // Only ever clear the demo account. An earlier version wiped the collections
  // outright, which took every other registered account's data with it.
  const existing = await User.findOne({ email: DEMO.email });
  if (existing) {
    console.log('[seed] clearing the existing demo account');
    await Promise.all([
      Category.deleteMany({ user: existing._id }),
      Expense.deleteMany({ user: existing._id }),
      Budget.deleteMany({ user: existing._id }),
      Settings.deleteMany({ user: existing._id }),
    ]);
    await User.deleteOne({ _id: existing._id });
  }

  const others = await User.countDocuments();
  if (others) console.log(`[seed] leaving ${others} other account${others === 1 ? '' : 's'} untouched`);

  const user = await User.create({
    name: DEMO.name,
    email: DEMO.email,
    passwordHash: await User.hashPassword(DEMO.password),
  });
  console.log(`[seed] demo account ${DEMO.email} / ${DEMO.password}`);

  const categories = await Category.insertMany(CATEGORIES.map((c) => ({ ...c, user: user._id })));
  const catByName = new Map(categories.map((c) => [c.name, c._id]));
  console.log(`[seed] ${categories.length} categories`);

  await Settings.create({
    user: user._id,
    currencyCode: 'BDT',
    currencySymbol: '৳',
    currencyLabel: 'Bangladeshi taka',
    monthStartsOn: 1,
    monthlyBudget: 60000,
    rounding: 'exact',
    reminders: {
      dailyNudge: true,
      budgetWarning: true,
      weeklySummary: false,
      roundInLists: false,
    },
  });

  // An expense carries no merchant any more, so the shop name from the source
  // data becomes the note where there isn't a more descriptive one.
  const augustRows = AUGUST.map((e) => ({
    user: user._id,
    date: day(2026, 8, e.d, 9 + (e.d % 11), (e.d * 7) % 60),
    amount: e.amount,
    category: e.cat ? catByName.get(e.cat) : null,
    note: e.note || e.merchant,
    tags: e.cat === 'Food & groceries' ? ['weekly'] : [],
    history: [{ what: 'Created', when: day(2026, 8, e.d) }],
  }));

  const historyRows = Object.keys(HISTORY)
    .flatMap((month) => buildHistoryRows(month, catByName))
    .map((r) => ({
      ...r,
      user: user._id,
      note: r.note || '',
      history: [{ what: 'Created', when: r.date }],
    }));

  const expenses = await Expense.insertMany([...augustRows, ...historyRows]);
  console.log(`[seed] ${expenses.length} expenses (${augustRows.length} in August 2026)`);

  const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  const budgets = months.flatMap((month) =>
    categories
      .filter((c) => BUDGET_LIMITS[c.name] !== undefined)
      .map((c) => ({
        month,
        user: user._id,
        category: c._id,
        limit: BUDGET_LIMITS[c.name],
        note:
          month === '2026-08' && c.name === 'Rent & bills'
            ? 'Fixed envelope, paid 20 Aug'
            : month === '2026-08' && c.name === 'Savings'
              ? 'Auto-moved on the 1st'
              : '',
      }))
  );
  await Budget.insertMany(budgets);
  console.log(`[seed] ${budgets.length} budget envelopes across ${months.length} months`);

  const augustSpend = augustRows
    .filter((r) => String(r.category) !== String(catByName.get('Savings')))
    .reduce((n, r) => n + r.amount, 0);
  console.log(`[seed] August 2026 spend: ${augustSpend.toLocaleString('en-US')} of 60,000`);

  await mongoose.disconnect();
  console.log('[seed] done');
}

run().catch(async (err) => {
  console.error('[seed] failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
