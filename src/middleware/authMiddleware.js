'use strict';

const KNOWN_ROLES = ['admin', 'grid_operator', 'utility_admin', 'plant_owner'];

/**
 * Identifies the active user from the `x-user-role` / `x-user-id` /
 * `x-user-email` headers set by the client after the one-click role login.
 * There is no token to verify and no recurring auth check — this never
 * rejects a request, it only makes req.user available to handlers (like
 * requireRole) that care about the caller's role.
 */
function identifyUser(req, res, next) {
  const role = req.headers['x-user-role'];
  if (role && KNOWN_ROLES.includes(role)) {
    req.user = {
      id: req.headers['x-user-id'],
      email: req.headers['x-user-email'],
      role,
    };
  }
  next();
}

/**
 * Role-based access control middleware factory.
 * @param {...string} roles - Allowed roles
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: true, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { identifyUser, requireRole };
