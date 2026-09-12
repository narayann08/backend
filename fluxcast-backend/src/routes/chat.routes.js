'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const rateLimit = require('express-rate-limit');
const { identifyUser } = require('../middleware/authMiddleware');
const Plant = require('../models/Plant');
const Alert = require('../models/Alert');
const Recommendation = require('../models/Recommendation');
const { completeText } = require('../services/llm/xaiClient');
const { evaluatePlantPerformance } = require('../services/analytics/performanceService');
const logger = require('../utils/logger');

router.use(identifyUser);

// Chat hits the LLM on every message, so keep a firm per-minute ceiling.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: true, message: 'Too many chat messages. Please wait a moment.' },
});

const SYSTEM_PROMPT = `You are the FluxCast operations assistant, answering questions for grid operators about ONE specific renewable power plant.

Rules:
- Answer only from the plant context provided in the user message. If the context does not contain the answer, say so plainly — never invent numbers.
- Be concise and practical: operators are experienced but not data scientists.
- Quote figures with units (MW, %, m/s, °C) and say when each figure was measured.
- If the plant is underperforming, lead with the most likely cause from the context.
- Plain prose. No markdown headers, no bullet lists longer than four items.`;

/**
 * Assemble the plant's live state from the database so the model answers from
 * real stored data rather than from memory.
 */
async function buildPlantContext(plant) {
  const [performance, recommendation, alerts] = await Promise.all([
    evaluatePlantPerformance(plant),
    Recommendation.findOne({ plantId: plant._id }).sort({ generatedAt: -1 }).lean(),
    Alert.find({ plantId: plant._id, acknowledged: false }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  return {
    plant: {
      name: plant.name,
      type: plant.type,
      capacityMW: plant.capacityMW,
      latitude: plant.latitude,
      longitude: plant.longitude,
      commissionedDate: plant.commissionedDate,
      hasLimitedHistory: plant.hasLimitedHistory,
    },
    currentPerformance: {
      measuredAt: performance.measuredAt,
      actualMW: performance.actualMW,
      expectedMW: performance.expectedMW,
      deltaPct: performance.deltaPct,
      classification: performance.classification,
      capacityFactorPct: performance.capacityFactorPct,
      sensorStatus: performance.sensorStatus,
      outage: performance.outage,
      reasons: performance.reasons,
    },
    currentWeather: performance.weather,
    latestRecommendation: recommendation
      ? {
          action: recommendation.action,
          amountMW: recommendation.amountMW,
          durationHours: recommendation.durationHours,
          reasoning: recommendation.reasoning,
          generatedAt: recommendation.generatedAt,
        }
      : null,
    openAlerts: alerts.map(a => ({
      severity: a.severity,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt,
    })),
  };
}

/**
 * POST /v1/plants/:plantId/chat
 * Plant-scoped operator chatbot. Answers strictly from this plant's stored
 * telemetry, forecast, weather and recommendations.
 *
 * Body: { message: string, history?: [{ role: 'user'|'assistant', content: string }] }
 */
router.post('/chat', chatLimiter, async (req, res, next) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: true, message: 'A non-empty "message" is required' });
    }

    const plant = await Plant.findById(req.params.plantId).lean();
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });

    const context = await buildPlantContext(plant);

    // Keep only the last few turns so the prompt stays small and on-topic.
    const priorTurns = Array.isArray(history)
      ? history
          .filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
          .slice(-6)
          .map(t => ({ role: t.role, content: t.content }))
      : [];

    const userMessage =
      `Plant context (live values from the FluxCast database):\n` +
      `${JSON.stringify(context, null, 2)}\n\n` +
      `Operator question: ${message.trim()}`;

    let reply;
    try {
      reply = await completeText({
        system: SYSTEM_PROMPT,
        messages: [...priorTurns, { role: 'user', content: userMessage }],
        maxTokens: 800,
      });
    } catch (err) {
      // Surface the real upstream failure — never answer with invented content.
      logger.error('[ChatRoute] Grok call failed:', err.message);
      return res.status(503).json({
        error: true,
        message: 'The AI assistant is unavailable right now. Check the X.AI API key and model configuration.',
        detail: err.message,
      });
    }

    if (!reply) {
      return res.status(503).json({ error: true, message: 'The AI assistant returned an empty response.' });
    }

    res.json({
      plantId: plant._id.toString(),
      question: message.trim(),
      reply,
      contextUsed: {
        measuredAt: context.currentPerformance.measuredAt,
        classification: context.currentPerformance.classification,
        openAlerts: context.openAlerts.length,
        hasRecommendation: Boolean(context.latestRecommendation),
      },
      answeredAt: new Date(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
