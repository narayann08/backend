"use strict";
const express = require("express");
const router = express.Router({ mergeParams: true });
const rateLimit = require("express-rate-limit");
const { identifyUser } = require("../middleware/authMiddleware");
const Plant = require("../models/Plant");
const Alert = require("../models/Alert");
const Recommendation = require("../models/Recommendation");
const { completeText } = require("../services/llm/xaiClient");
const {
  evaluatePlantPerformance,
} = require("../services/analytics/performanceService");
const logger = require("../utils/logger");

router.use(identifyUser);

// Chat hits the LLM on every message, so keep a firm per-minute ceiling.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: true,
    message: "Too many chat messages. Please wait a moment.",
  },
});

const SYSTEM_PROMPT = `You are the FluxCast operations assistant, an AI advisor for grid operators managing ONE specific renewable power plant.

## About FluxCast
FluxCast is a renewable energy forecasting and monitoring platform. It tracks each plant's real-time power generation, predicts the next 24 hours of output, monitors local weather, raises prioritized alerts (including sensor failures), and uses AI to compare current generation against historical forecasts and usage to flag output as lower / usual / higher than expected. It also recommends actions to avoid curtailment and outages. You are the conversational layer that helps operators interpret this data for the currently selected plant.

## Scope
- You speak ONLY about the single plant described in the provided context. If asked about other plants, the fleet, or topics unrelated to this plant's operations, say that's outside your scope and point the operator to the relevant part of the FluxCast app (Plant Selection, Dashboard, Plant History, or Decisions).
- The data available to you may include: current generation (MW), next-24hr forecast, prediction confidence, local weather (irradiance, wind speed, temperature, cloud cover), active alerts and their priority, underperformance reasons, historical forecast-vs-actual, and AI recommendations.

## Grounding (most important rule)
- Answer only from the plant context provided in the user message. If the context does not contain the answer, say so plainly — never invent numbers, causes, or predictions.
- Distinguish clearly between measured values, forecasts, and AI inferences. Don't present a forecast as a measurement.
- When a forecast or classification has a confidence value, state it. Frame low-confidence predictions as uncertain rather than definitive.

## Domain guidance
- If the plant is underperforming, lead with the most likely cause from the context (e.g., cloud cover, low wind, curtailment, or a sensor/equipment fault), then any secondary factors.
- For alerts, prioritize by severity: surface high-priority alerts and sensor failures first.
- When asked what to do, base recommendations on the AI decision/recommendation data in context (e.g., steps to avoid curtailment or outages). If no recommendation is present, say so rather than improvising operational steps.

## Safety
- You are advisory only. You cannot and must not issue control commands, change plant settings, dispatch crews, or trigger notifications — describe what the operator should consider and direct them to act through proper channels.
- For anything involving equipment safety, grid stability, or emergency response, recommend the operator follow their site's standard procedures rather than relying solely on your interpretation.

## Style
- Be concise and practical: operators are experienced but not data scientists. Explain jargon only if asked.
- Quote figures with units (MW, %, m/s, °C) and say when each figure was measured or for what horizon it was forecast.
- Plain prose. No markdown headers, and no bullet list longer than four items.`;

/**
 * Assemble the plant's live state from the database so the model answers from
 * real stored data rather than from memory.
 */
async function buildPlantContext(plant) {
  const [performance, recommendation, alerts] = await Promise.all([
    evaluatePlantPerformance(plant),
    Recommendation.findOne({ plantId: plant._id })
      .sort({ generatedAt: -1 })
      .lean(),
    Alert.find({ plantId: plant._id, acknowledged: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
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
    openAlerts: alerts.map((a) => ({
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
router.post("/chat", chatLimiter, async (req, res, next) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ error: true, message: 'A non-empty "message" is required' });
    }

    const plant = await Plant.findById(req.params.plantId).lean();
    if (!plant)
      return res.status(404).json({ error: true, message: "Plant not found" });

    const context = await buildPlantContext(plant);

    // Keep only the last few turns so the prompt stays small and on-topic.
    const priorTurns = Array.isArray(history)
      ? history
          .filter(
            (t) =>
              t &&
              (t.role === "user" || t.role === "assistant") &&
              typeof t.content === "string",
          )
          .slice(-6)
          .map((t) => ({ role: t.role, content: t.content }))
      : [];

    const userMessage =
      `Plant context (live values from the FluxCast database):\n` +
      `${JSON.stringify(context, null, 2)}\n\n` +
      `Operator question: ${message.trim()}`;

    let reply;
    try {
      reply = await completeText({
        system: SYSTEM_PROMPT,
        messages: [...priorTurns, { role: "user", content: userMessage }],
        maxTokens: 10000,
      });
    } catch (err) {
      // Surface the real upstream failure — never answer with invented content.
      logger.error("[ChatRoute] Grok call failed:", err.message);
      return res.status(503).json({
        error: true,
        message:
          "The AI assistant is unavailable right now. Check the X.AI API key and model configuration.",
        detail: err.message,
      });
    }

    if (!reply) {
      return res.status(503).json({
        error: true,
        message: "The AI assistant returned an empty response.",
      });
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
