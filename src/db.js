import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const { host, name } = mongoose.connection;
  console.log(`[db] connected to ${host}/${name}`);
  return mongoose.connection;
}

/**
 * Bring the collections' indexes in line with the schemas, dropping any that no
 * longer belong.
 *
 * This matters because the single-user version of this app indexed
 * `Category.name` and `Settings.key` as globally unique. Those indexes survive
 * a `deleteMany`, and left in place they would reject the second account that
 * tried to create a category named "Transport" — or register at all, since
 * every new settings document has no `key` and they would collide on null.
 */
export async function syncIndexes(models) {
  const results = await Promise.all(
    models.map(async (Model) => {
      const dropped = await Model.syncIndexes();
      return dropped?.length ? `${Model.modelName}: dropped ${dropped.join(', ')}` : null;
    })
  );
  const changes = results.filter(Boolean);
  console.log(
    changes.length ? `[db] indexes synced — ${changes.join('; ')}` : '[db] indexes up to date'
  );
}