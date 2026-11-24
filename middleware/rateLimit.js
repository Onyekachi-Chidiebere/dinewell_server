const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 30, keyPrefix = 'default' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const identity = req.auth?.userId || req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${identity}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests' });
    }
    return next();
  };
}

module.exports = rateLimit;
