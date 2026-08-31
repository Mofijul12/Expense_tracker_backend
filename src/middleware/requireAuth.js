import User from '../models/User.js';
import { readToken, verifyToken } from '../lib/token.js';
import { HttpError } from './asyncHandler.js';

/**
 * Gate for everything under /api that holds a person's money data.
 *
 * On success `req.userId` carries the owner id that every query in this app
 * filters by — that scoping is what stops one account reading another's
 * expenses, so no data route may skip this middleware.
 */
export async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) throw new HttpError(401, 'Sign in to continue');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new HttpError(401, 'Your session has expired — sign in again');
    }

    // Confirm the account still exists; a deleted user must not keep access
    // just because their token has not expired yet.
    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'That account no longer exists');

    req.userId = user._id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
