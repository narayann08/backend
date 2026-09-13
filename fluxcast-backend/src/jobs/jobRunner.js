'use strict';
const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * Shared scheduling for the background jobs.
 *
 * Two behaviours every job here needs and none of them used to have. First, a
 * run at start-up: a server that had been down came back and then sat idle
 * until the next tick, so the dashboard served stale data for up to an hour
 * after a deploy. Second, an overlap guard: at a 15-minute cadence a slow run
 * — eight plants, two model calls each — can still be going when the next tick
 * arrives, and two copies writing the same hour produce duplicates.
 */

/**
 * @param {object} params
 * @param {string} params.name - Job name, for logs
 * @param {string} params.expression - node-cron expression
 * @param {() => Promise<void>} params.task
 * @param {boolean} [params.runOnStart=true]
 * @param {number} [params.startDelayMs=0] - Stagger, so boot runs keep their order
 * @returns {{name: string, stop: () => void, trigger: () => Promise<void>}}
 */
function scheduleJob({ name, expression, task, runOnStart = true, startDelayMs = 0 }) {
  let running = false;

  const run = async (trigger) => {
    if (running) {
      logger.warn(`[${name}] Previous run still in progress — skipping this ${trigger}`);
      return;
    }
    running = true;
    const started = Date.now();
    try {
      await task();
      logger.info(`[${name}] ${trigger} run finished in ${Date.now() - started}ms`);
    } catch (err) {
      logger.error(`[${name}] ${trigger} run failed: ${err.message}`);
    } finally {
      running = false;
    }
  };

  const scheduled = cron.schedule(expression, () => run('scheduled'));
  logger.info(`[${name}] Scheduled (${expression})`);

  if (runOnStart) {
    setTimeout(() => run('startup'), startDelayMs).unref?.();
  }

  return { name, stop: () => scheduled.stop(), trigger: () => run('manual') };
}

module.exports = { scheduleJob };
