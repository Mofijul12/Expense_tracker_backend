import jwt from 'jsonwebtoken';

const COOKIE = 'ledgerline_token';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not set — copy .env.example to .env and fill it in.');
  return value;
}

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, secret(), {
    expiresIn: process.env.JWT_EXPIRES || '30d',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, secret());
}

/**
 * The token rides in an httpOnly cookie, so page scripts can't read it and an
 * XSS bug can't walk off with the session.
 */
export function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Cookie first; the Authorization header is there for API clients and tests. */
export function readToken(req) {
  if (req.cookies?.[COOKIE]) return req.cookies[COOKIE];
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export const AUTH_COOKIE = COOKIE;
