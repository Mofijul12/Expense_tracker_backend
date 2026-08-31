import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  { what: { type: String, required: true }, when: { type: Date, default: Date.now } },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    note: { type: String, default: '', trim: true },
    tags: { type: [String], default: [] },
    history: { type: [historySchema], default: [] },
    // Set when a row was produced by splitting another expense.
    splitFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1, date: -1 });

expenseSchema.virtual('month').get(function () {
  return this.date ? this.date.toISOString().slice(0, 7) : null;
});

expenseSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Expense', expenseSchema);
