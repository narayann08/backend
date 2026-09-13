'use strict';
const { completeJson } = require('../llm/xaiClient');
const logger = require('../../utils/logger');
const notificationTool = require('../mcp-tools/notificationTool');
const { ALERT_TYPE_BY_RISK, severityForRisk } = require('../forecast/riskWindows');

/** Risk windows are read by operators working in IST. */
function formatWindow(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

/**
 * Explainability Agent.
 *
 * Converts the forecast + recommendation into a short, plain-language explanation
 * for the dashboard root-cause panel. If risk windows were flagged in the forecast,
 * raises real-time alerts via notificationTool.
 *
 * In simulation mode, no alerts are raised and no data is persisted.
 *
 * @param {object} state - Shared LangGraph workflow state
 * @returns {Promise<object>} Updated state with `explanation` and `explanationFactors`
 */
async function runExplainabilityAgent(state) {
  const { plant, forecast, recommendation, simulationMode } = state;
  const start = Date.now();
  logger.info(`[ExplainAgent] Starting for plant ${plant._id}`);

  // ── Step 1: Generate plain-language explanation ───────────────────────────
  const systemPrompt = `You are the Explainability Agent for FluxCast, a renewable energy grid platform.
Produce a short, clear, jargon-free explanation of why the generation forecast and recommendation look the way they do.
This will be shown to grid operators on a dashboard — they are experienced but not data scientists.

Output ONLY valid JSON — no markdown, no extra text:
{"summary":"1-2 sentence plain-language explanation","factors":["key factor 1","key factor 2","key factor 3"]}`;

  const avgMW = forecast.points?.length
    ? (forecast.points.reduce((s, p) => s + (p.expectedMW || 0), 0) / forecast.points.length).toFixed(1)
    : 'N/A';

  const userMessage =
    `Plant: ${plant.name} (${plant.type}, ${plant.capacityMW} MW)\n` +
    `Forecast: avg ${avgMW} MW over ${forecast.horizonHours}h, ${forecast.riskWindows?.length || 0} risk windows\n` +
    `Recommendation: ${recommendation.action} — "${(recommendation.reasoning || '').slice(0, 200)}"\n` +
    `Risk windows: ${JSON.stringify(forecast.riskWindows || [])}\n\n` +
    `Explain this forecast and recommendation in simple terms for the operator.`;

  let explanation;
  try {
    explanation = await completeJson({ system: systemPrompt, user: userMessage, maxTokens: 1024 });
    logger.info('[ExplainAgent] LLM explanation generated');
  } catch (err) {
    logger.warn('[ExplainAgent] LLM explanation failed — using fallback:', err.message);
    explanation = {
      summary: `${plant.name}: ${recommendation.action} recommended based on current weather and generation forecast.`,
      factors: ['weather_conditions', 'generation_forecast', 'grid_constraints'],
    };
  }

  // ── Step 2: Raise alerts for risk windows (real runs only) ────────────────
  if (!simulationMode && forecast.riskWindows?.length > 0) {
    for (const rw of forecast.riskWindows) {
      const alertType = ALERT_TYPE_BY_RISK[rw.type] || 'extreme_weather';

      /*
       * Severity comes from how far the window actually goes past its
       * threshold, decided where the numbers are (see riskWindows.js). It used
       * to be a coin-flip on the window type, which made every alert "high"
       * and the console's severity filters decorative.
       */
      const severity = rw.severity || severityForRisk(rw);

      try {
        await notificationTool.handler({
          plantId:  plant._id.toString(),
          severity,
          type:     alertType,
          // The window's own detail, not the whole operator explanation —
          // an alert is a headline and the rationale lives on the Decisions page.
          message:  rw.detail || `${rw.type} expected from ${formatWindow(rw.start)} to ${formatWindow(rw.end)}.`,
        });
      } catch (err) {
        logger.error('[ExplainAgent] Failed to raise alert:', err.message);
      }
    }
  }

  logger.info(`[ExplainAgent] Completed in ${Date.now() - start}ms`);
  return {
    ...state,
    explanation:        explanation.summary,
    explanationFactors: explanation.factors,
  };
}

module.exports = { runExplainabilityAgent };
