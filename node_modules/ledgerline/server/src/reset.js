/**
 * Empties the database: every user account plus all their expenses,
 * categories, budgets and settings.
 *
 *   npm run reset
 *
 * Accounts are removed too, so you register again from the home page.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, syncIndexes } from './db.js';
import Category from './models/Category.js';
import Expense from './models/Expense.js';
import Budget from './models/Budget.js';
import Settings from './models/Settings.js';
import User from './models/User.js';

async function run() {
  await connectDB(process.env.MONGODB_URI);
  await syncIndexes([User, Expense, Category, Budget, Settings]);

  const before = {
    expenses: await Expense.countDocuments(),
    categories: await Category.countDocuments(),
    budgets: await Budget.countDocuments(),
    settings: await Settings.countDocuments(),
    users: await User.countDocuments(),
  };

  const [expenses, categories, budgets, settings, users] = await Promise.all([
    Expense.deleteMany({}),
    Category.deleteMany({}),
    Budget.deleteMany({}),
    Settings.deleteMany({}),
    User.deleteMany({}),
  ]);

  console.log('[reset] removed:');
  console.log(`  expenses   ${expenses.deletedCount} (was ${before.expenses})`);
  console.log(`  categories ${categories.deletedCount} (was ${before.categories})`);
  console.log(`  budgets    ${budgets.deletedCount} (was ${before.budgets})`);
  console.log(`  settings   ${settings.deletedCount} (was ${before.settings})`);
  console.log(`  users      ${users.deletedCount} (was ${before.users})`);

  const remaining = await Expense.countDocuments();
  console.log(`[reset] database is ${remaining === 0 ? 'empty' : `NOT empty — ${remaining} left`}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('[reset] failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
