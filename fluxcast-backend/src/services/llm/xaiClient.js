'use strict';
const OpenAI = require('openai');
const env = require('../../config/env');

/**
 * Shared OpenAI SDK client pointed at xAI's Grok API (OpenAI-compatible),
 * used by every agent in the forecasting pipeline.
 */
const xaiClient = new OpenAI({
  apiKey:  env.XAI_API_KEY,
  baseURL: env.XAI_BASE_URL,
});

/**
 * Call Grok chat completions and parse a JSON-only response. Strips markdown
 * code fences in case the model wraps its JSON despite instructions not to.
 * @param {{ system: string, user: string, maxTokens?: number }} params
 * @returns {Promise<any>} Parsed JSON (object or array, per the caller's schema)
 */
async function completeJson({ system, user, maxTokens = 2048 }) {
  const response = await xaiClient.chat.completions.create({
    model:      env.XAI_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const raw = response.choices[0]?.message?.content || '';
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/**
 * Call Grok chat completions for a free-text (non-JSON) answer, such as the
 * operator chatbot.
 * @param {{ system: string, messages: Array<{role: string, content: string}>, maxTokens?: number }} params
 * @returns {Promise<string>} The assistant's reply text
 */
async function completeText({ system, messages, maxTokens = 1024 }) {
  const response = await xaiClient.chat.completions.create({
    model:      env.XAI_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...messages],
  });

  return (response.choices[0]?.message?.content || '').trim();
}

module.exports = { xaiClient, completeJson, completeText };
