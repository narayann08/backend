'use strict';
const logger = require('../../utils/logger');
const { runWeatherReasoningAgent } = require('../agents/weatherReasoningAgent');
const { runForecastingAgent }      = require('../agents/forecastingAgent');
const { runDecisionAgent }         = require('../agents/decisionAgent');
const { runExplainabilityAgent }   = require('../agents/explainabilityAgent');

/**
 * @typedef {object} WorkflowInput
 * @property {object}  plant           - Plant document (lean)
 * @property {number}  [horizon=24]    - Forecast horizon in hours (24 | 48 | 72)
 * @property {string}  [jobId]         - Job tracking UUID
 * @property {boolean} [simulationMode=false] - If true, results are NOT persisted
 * @property {string}  [scenario]      - Human-readable simulation scenario description
 * @property {object}  [overrides]     - Simulation overrides (demandChangePct, etc.)
 */

/**
 * Run the full four-agent LangGraph forecast workflow:
 *
 *   WeatherReasoning → Forecasting → Decision → Explainability
 *
 * Shared state is passed between nodes. Each agent reads from state,
 * calls its MCP tools, writes its output back, and returns the updated state.
 * Every agent step is logged so operators can audit the reasoning chain.
 *
 * @param {WorkflowInput} input
 * @returns {Promise<{forecast, recommendation, explanation, explanationFactors}>}
 */
async function runForecastWorkflow(input) {
  const { plant, horizon = 24, jobId, simulationMode = false, scenario, overrides } = input;
  const workflowStart = Date.now();

  logger.info(
    `[Workflow] ▶ Starting | plant=${plant._id} (${plant.name}) | horizon=${horizon}h | ` +
    `simulation=${simulationMode} | jobId=${jobId}`
  );

  // ── Shared state object ───────────────────────────────────────────────────
  let state = {
    plant,
    horizon,
    jobId,
    simulationMode,
    scenario,
    overrides,
    weatherSnapshot:    null,
    forecast:           null,
    recommendation:     null,
    explanation:        null,
    explanationFactors: [],
  };

  // ── Node 1: Weather-Reasoning Agent ──────────────────────────────────────
  logger.info('[Workflow] Node 1/4: WeatherReasoningAgent');
  const weatherSnapshot = await runWeatherReasoningAgent(plant, horizon);
  state.weatherSnapshot = weatherSnapshot;
  logger.info(`[Workflow] Node 1 done — ${weatherSnapshot.hourly?.length} hourly entries`);

  // ── Node 2: Forecasting Agent ────────────────────────────────────────────
  logger.info('[Workflow] Node 2/4: ForecastingAgent');
  state = await runForecastingAgent(state);
  logger.info(`[Workflow] Node 2 done — ${state.forecast?.points?.length} forecast points`);

  // ── Node 3: Decision Agent ────────────────────────────────────────────────
  logger.info('[Workflow] Node 3/4: DecisionAgent');
  state = await runDecisionAgent(state);
  logger.info(`[Workflow] Node 3 done — action: ${state.recommendation?.action}`);

  // ── Node 4: Explainability Agent ─────────────────────────────────────────
  logger.info('[Workflow] Node 4/4: ExplainabilityAgent');
  state = await runExplainabilityAgent(state);
  logger.info('[Workflow] Node 4 done');

  const elapsed = Date.now() - workflowStart;
  logger.info(`[Workflow] ✔ Complete in ${elapsed}ms | jobId=${jobId}`);

  return {
    forecast:           state.forecast,
    recommendation:     state.recommendation,
    explanation:        state.explanation,
    explanationFactors: state.explanationFactors,
  };
}

module.exports = { runForecastWorkflow };
