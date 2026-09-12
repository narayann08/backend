'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const env = require('../../config/env');

/**
 * Register a new user.
 * @param {object} userData
 * @returns {Promise<{token: string, user: object}>}
 */
async function register(userData) {
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    const err = new Error('User already exists');
    err.status = 409;
    throw err;
  }

  const user = new User(userData);
  await user.save();

  const payload = { id: user._id, email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
}

/**
 * Predefined roles selectable from the startup role-selection screen. Each
 * key is a login endpoint slug that maps to one shared user document already
 * stored in the users collection — no credentials, no new accounts.
 */
const ROLE_LOGIN_MAP = {
  'system-admin':       { role: 'admin',         label: 'System Admin' },
  'lead-grid-operator': { role: 'grid_operator', label: 'Lead Grid Operator' },
  'utility-admin':      { role: 'utility_admin', label: 'Utility Admin' },
};

/**
 * List the predefined roles available for one-click login.
 * @returns {Array<{key: string, role: string, label: string}>}
 */
function listRoles() {
  return Object.entries(ROLE_LOGIN_MAP).map(([key, cfg]) => ({
    key,
    role: cfg.role,
    label: cfg.label,
  }));
}

/**
 * One-click login: no credentials taken. Fetches the single stored user for
 * the given predefined role.
 * @param {string} roleKey - one of the ROLE_LOGIN_MAP keys
 * @returns {Promise<{user: object}>}
 */
async function loginWithRole(roleKey) {
  const config = ROLE_LOGIN_MAP[roleKey];
  if (!config) {
    const err = new Error(`Unknown login role '${roleKey}'`);
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({ role: config.role });
  if (!user) {
    const err = new Error(
      `No stored user found for role '${config.role}'. Seed the users collection first.`
    );
    err.status = 404;
    throw err;
  }

  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
}

/**
 * Get User Profile
 * @param {string} userId 
 * @returns {Promise<object>}
 */
async function getProfile(userId) {
  const user = await User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpires');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

/**
 * Generate a password reset token
 * @param {string} email 
 * @returns {Promise<{resetToken: string, message: string}>}
 */
async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  // Generate a random token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token before saving to db for security
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  // In a real app, send an email here. We just return it for testing.
  return { 
    message: 'Token generated (usually sent via email)', 
    resetToken 
  };
}

/**
 * Reset password using token
 * @param {string} resetToken 
 * @param {string} newPassword 
 */
async function resetPassword(resetToken, newPassword) {
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    const err = new Error('Invalid or expired reset token');
    err.status = 400;
    throw err;
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return { message: 'Password reset successful' };
}

module.exports = {
  register,
  getProfile,
  forgotPassword,
  resetPassword,
  listRoles,
  loginWithRole,
  ROLE_LOGIN_MAP,
};
