'use strict';
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const batteryStatusTool = require('../mcp-tools/batteryStatusTool');
const demandDataTool = require('../mcp-tools/demandDataTool');
const Recommendation = require('../../models/Recommendation');

/**
 * Decision Agent.
 *
 * Turns the generation forecast into a concrete recommended grid action,
 * respecting real-world constraints (battery SoC, grid demand, transmission limits).
 * In simulation mode, results are NOT persisted to the database.
 *
 * @param {object} state - Shared LangGraph workflow state
 * @returns {Promise<object>} Updated state with `recommendation` field set
 */
async function runDecisionAgent(state) {
  const { plant, forecast, simulationMode, overrides } = state;
  const start = Date.now();
  logger.info(`[DecisionAgent] Starting for plant ${plant._id}`);

  // ── Step 1: Fetch constraints via MCP tools ───────────────────────────────
  const [batteryStatus, demandData] = await Promise.all([
    batteryStatusTool.handler({ plantId: plant._id.toString() }),
    demandDataTool.handler({ plantId: plant._id.toString(), hours: forecast.horizonHours || 24 }),
  ]);

  // ── Step 2: LLM-powered decision ─────────────────────────────────────────
  const llm = new ChatOpenAI({
    openAIApiKey: env.XAI_API_KEY,
    modelName:    env.XAI_MODEL,
    maxTokens:    2048,
    configuration: { baseURL: env.XAI_BASE_URL },
  });

  const systemPrompt = `You are the Decision Agent for FluxCast, a renewable energy grid decision support platform.
Given a generation forecast, battery status, and demand data, recommend the optimal grid action.

Allowed actions: charge_battery, discharge_battery, curtail, export, activate_backup, hold

Decision logic:
1. generation > demand + spare battery capacity → curtail (avoid over-generation)
2. generation > demand AND battery not full → charge_battery
3. generation > demand AND battery full → export to grid
4. generation < demand AND battery charged (>20%) → discharge_battery
5. generation very low (<10% capacity) during peak demand (8am–8pm) AND battery low → activate_backup
6. Otherwise → hold

Constraints to evaluate: battery_capacity, transmission_limit, cost, demand_forecast, ramp_rate

Output ONLY valid JSON — no markdown, no explanation:
{"action":"hold","amountMW":0,"durationHours":1,"reasoning":"Clear operator explanation","constraintsConsidered":["battery_capacity","demand_forecast"]}`;

  const simulationNote = simulationMode && overrides
    ? `\n\nSIMULATION OVERRIDES ACTIVE: ${JSON.stringify(overrides)}\nApply these overrides when calculating your recommendation.`
    : '';

  const userMessage =
    `Plant: ${plant.name} (${plant.type}, capacity ${plant.capacityMW} MW)\n` +
    `Forecast (first 6h): ${JSON.stringify(forecast.points?.slice(0, 6) || [])}\n` +
    `Risk windows: ${JSON.stringify(forecast.riskWindows || [])}\n` +
    `Battery status: ${JSON.stringify(batteryStatus)}\n` +
    `Demand forecast (first 6h): ${JSON.stringify(demandData.hourly?.slice(0, 6) || [])}` +
    simulationNote +
    `\n\nProvide your recommendation.`;

  let recData;
  try {
    const response = await llm.invoke([new SystemMessage(systemPrompt), new HumanMessage(userMessage)]);
    recData = JSON.parse(response.content);
    logger.info(`[DecisionAgent] LLM recommended action: ${recData.action}`);
  } catch (err) {
    logger.error('[DecisionAgent] LLM decision failed — defaulting to hold:', err.message);
    recData = {
      action:               'hold',
      amountMW:             0,
      durationHours:        1,
      reasoning:            'Could not generate recommendation — defaulting to hold.',
      constraintsConsidered: ['system_error'],
    };
  }

  // ── Step 3: Persist (only in real runs, not simulation) ───────────────────
  let savedRec;
  if (!simulationMode) {
    savedRec = await Recommendation.create({
      plantId:          plant._id,
      forecastResultId: forecast._id,
      ...recData,
    });
    logger.info(`[DecisionAgent] Saved recommendation ${savedRec._id}`);
    savedRec = savedRec.toObject();
  } else {
    savedRec = { plantId: plant._id, ...recData };
    logger.info('[DecisionAgent] Simulation mode — recommendation not persisted');
  }

  logger.info(`[DecisionAgent] Completed in ${Date.now() - start}ms`);
  return { ...state, recommendation: savedRec };
}

module.exports = { runDecisionAgent };
