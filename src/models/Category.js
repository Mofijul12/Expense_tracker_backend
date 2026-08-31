import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: 'ph ph-tag' },
    // Index into the accent ramp the UI paints bars, swatches and donut arcs with.
    colorIndex: { type: Number, default: 0, min: 0, max: 4 },
    // Plain-language auto-sort rule shown on the Categories screen.
    rule: { type: String, default: 'No rule', trim: true },
    // Keywords matched against an expense's note to auto-assign this category.
    keywords: { type: [String], default: [] },
    // Savings transfers are tracked but kept out of "spent" totals.
    excludeFromSpend: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.index({ user: 1, order: 1, name: 1 });
// Names are unique per account, not globally.
categorySchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);
