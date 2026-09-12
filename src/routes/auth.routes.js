'use strict';
const express = require('express');
const router = express.Router();
const authService = require('../services/auth/authService');

/**
 * POST /v1/auth/login
 * Issues a JWT for a registered user.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
