'use strict';
const express = require('express');
const router = express.Router();
const authService = require('../services/auth/authService');

/**
 * GET /v1/auth/roles
 * Lists the predefined roles shown on the startup role-selection screen.
 */
router.get('/roles', (req, res) => {
  res.json({ roles: authService.listRoles() });
});

/**
 * POST /v1/auth/login/system-admin
 * POST /v1/auth/login/lead-grid-operator
 * POST /v1/auth/login/utility-admin
 *
 * One-click login: no credentials are taken. Each endpoint fetches the
 * single stored user for that role from the users collection and returns
 * it directly — no token is issued.
 */
for (const roleKey of Object.keys(authService.ROLE_LOGIN_MAP)) {
  router.post(`/login/${roleKey}`, async (req, res, next) => {
    try {
      const result = await authService.loginWithRole(roleKey);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
}

module.exports = router;
