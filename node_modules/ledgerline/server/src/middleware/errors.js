import { HttpError } from './asyncHandler.js';

export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      error: 'Validation failed',
      details: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])),
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'That already exists', details: err.keyValue });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}
