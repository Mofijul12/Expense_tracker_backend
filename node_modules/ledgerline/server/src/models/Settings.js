import mongoose from 'mongoose';

// One preferences document per account.
const settingsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    currencyCode: { type: String, default: 'BDT' },
    currencySymbol: { type: String, default: '৳' },
    currencyLabel: { type: String, default: 'Bangladeshi taka' },
    monthStartsOn: { type: Number, default: 1, min: 1, max: 28 },
    monthlyBudget: { type: Number, default: 60000, min: 0 },
    rounding: { type: String, enum: ['exact', 'whole'], default: 'exact' },
    reminders: {
      dailyNudge: { type: Boolean, default: true },
      budgetWarning: { type: Boolean, default: true },
      weeklySummary: { type: Boolean, default: false },
      roundInLists: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

/** Fetch this user's settings, creating them with defaults on first read. */
settingsSchema.statics.load = async function (userId) {
  if (!userId) throw new Error('Settings.load requires a user id');
  return this.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export default mongoose.model('Settings', settingsSchema);
