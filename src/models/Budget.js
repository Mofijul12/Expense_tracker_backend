import mongoose from 'mongoose';

// One envelope per category per month, e.g. Food & groceries capped at 19,500 in 2026-08.
const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    limit: { type: Number, required: true, min: 0 },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, month: 1, category: 1 }, { unique: true });

export default mongoose.model('Budget', budgetSchema);
