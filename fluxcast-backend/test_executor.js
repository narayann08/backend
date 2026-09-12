#!/usr/bin/env node
'use strict';

/**
 * FluxCast Master Test Executor
 *
 * Verifies database connectivity first (aborts if DB is offline),
 * runs all unit, tool, agent, and API route test suites,
 * executes the Python FastAPI proxy test suite,
 * and prints a comprehensive feature evaluation matrix.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { spawnSync } = require('child_process');
const path = require('path');
const env = require('./src/config/env');

const BOLD  = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const YELLOW= '\x1b[33m';
const RESET = '\x1b[0m';

function banner(text) {
  const line = '═'.repeat(78);
  console.log(`\n${CYAN}${line}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`);
  console.log(`${CYAN}${line}${RESET}\n`);
}

function subHeader(text) {
  console.log(`\n${YELLOW}── ${text} ${'─'.repeat(Math.max(0, 74 - text.length))}${RESET}\n`);
}

// ── Step 1: Mandatory Database Pre-Flight Check ─────────────────────────────
async function checkDatabaseConnection() {
  banner('PHASE 1: MANDATORY DATABASE CONNECTIVITY PRE-FLIGHT CHECK');

  const targetUri = env.MONGODB_URI;
  const maskedUri = targetUri
    ? targetUri.replace(/:([^@]+)@/, ':****@')
    : 'UNDEFINED';

  console.log(`Testing connection to: ${BOLD}${maskedUri}${RESET}`);
  console.log('Connecting with 6000ms timeout...');

  try {
    // Attempt connection
    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 6000,
    });

    console.log(`${GREEN}✔ Primary MongoDB connection verified!${RESET}`);
    console.log(`  State: ${BOLD}Connected${RESET} (ReadyState: ${mongoose.connection.readyState})`);
    console.log(`  Host:  ${mongoose.connection.host || 'cluster'}`);
    console.log(`  DB:    ${mongoose.connection.name}`);
    await mongoose.disconnect();
    return true;
  } catch (primaryErr) {
    console.log(`${YELLOW}⚠ Primary URI check failed: ${primaryErr.message}${RESET}`);

    // Test local MongoDB fallback
    const localUri = 'mongodb://127.0.0.1:27017/fluxcast';
    console.log(`Testing local fallback: ${BOLD}${localUri}${RESET}...`);
    try {
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
      console.log(`${GREEN}✔ Local MongoDB fallback verified successfully!${RESET}`);
      console.log(`  State: ${BOLD}Connected${RESET} (ReadyState: ${mongoose.connection.readyState})`);
      await mongoose.disconnect();
      return true;
    } catch (localErr) {
      console.error(`\n${RED}${BOLD}✖ DATABASE CONNECTION FAILED!${RESET}`);
      console.error(`${RED}Primary Error: ${primaryErr.message}${RESET}`);
      console.error(`${RED}Fallback Error: ${localErr.message}${RESET}`);
      console.error(`\n${RED}${BOLD}STOPPING TESTING: A live database connection is required.${RESET}\n`);
      process.exit(1);
    }
  }
}

// ── Step 2: Run Jest Test Suites ────────────────────────────────────────────
function runJestSuites() {
  banner('PHASE 2: RUNNING FLUXCAST BACKEND TEST SUITES (JEST)');

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['jest', '--runInBand', '--forceExit', '--detectOpenHandles'];

  console.log(`Executing: ${npxCmd} ${args.join(' ')}\n`);

  const result = spawnSync(npxCmd, args, {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'test' },
  });

  return result.status === 0;
}

// ── Step 3: Run Python FastAPI Proxy Tests ──────────────────────────────────
function runProxyTests() {
  banner('PHASE 3: RUNNING NASA POWER FASTAPI PROXY TEST SUITE (PYTHON)');

  const pythonExec =
    process.env.PYTHON_PATH ||
    (process.platform === 'win32'
      ? 'C:\\Users\\naray\\AppData\\Local\\Programs\\Python\\Python313\\python.exe'
      : 'python3');
  const proxyDir = path.resolve(__dirname, '..', 'nasa-power-api-main');

  console.log(`Executing Python test suite in: ${proxyDir}`);
  console.log(`Command: ${pythonExec} test_proxy.py\n`);

  const result = spawnSync(pythonExec, ['test_proxy.py'], {
    cwd: proxyDir,
    stdio: 'inherit',
  });

  return result.status === 0;
}

// ── Step 4: Final Feature Evaluation Matrix ─────────────────────────────────
function printFeatureMatrix(jestPassed, proxyPassed) {
  banner('PHASE 4: FINAL SYSTEM EVALUATION & FEATURE MATRIX');

  const features = [
    { module: 'Authentication', feature: 'JWT Login & Role Validation', status: jestPassed },
    { module: 'Plant Management', feature: 'Solar & Wind Plant CRUD', status: jestPassed },
    { module: 'Telemetry', feature: 'SCADA Ingestion & 96h History', status: jestPassed },
    { module: 'Weather Integration', feature: 'Open-Meteo NWP Forecast Connector', status: jestPassed },
    { module: 'Weather Integration', feature: 'NASA POWER Satellite Observations', status: jestPassed },
    { module: 'Weather Reasoning', feature: 'Multi-Source Weather Reconciliation Agent', status: jestPassed },
    { module: 'Generation Forecast', feature: 'Physics-Based & Grok LLM Forecasting', status: jestPassed },
    { module: 'RAG Retrieval', feature: 'Similar Pattern Search for New Plants', status: jestPassed },
    { module: 'Grid Decision Agent', feature: 'Battery, Curtail & Export Actions', status: jestPassed },
    { module: 'Explainability Agent', feature: 'Root-Cause Plain-Language Narrative', status: jestPassed },
    { module: 'Alerts & Real-Time', feature: 'Risk Window Flags & Notification Tool', status: jestPassed },
    { module: 'Scenario Simulation', feature: 'Demand Spike & Equipment Outage Stress', status: jestPassed },
    { module: 'Portfolio Aggregation', feature: 'Multi-Plant Supply Aggregation', status: jestPassed },
    { module: 'NASA Proxy (FastAPI)', feature: 'CORS & Records Formatting', status: proxyPassed },
    { module: 'NASA Proxy (FastAPI)', feature: 'NASA Direct Route Compatibility', status: proxyPassed },
    { module: 'NASA Proxy (FastAPI)', feature: 'Interactive OpenAPI /docs & CSV Export', status: proxyPassed },
  ];

  console.log(`${BOLD}${'Module'.padEnd(24)} ${'Feature'.padEnd(46)} ${'Status'.padEnd(10)}${RESET}`);
  console.log('─'.repeat(82));

  let allPassed = true;
  for (const item of features) {
    const statusLabel = item.status ? `${GREEN}✔ PASSED${RESET}` : `${RED}✖ FAILED${RESET}`;
    if (!item.status) allPassed = false;
    console.log(`${item.module.padEnd(24)} ${item.feature.padEnd(46)} ${statusLabel}`);
  }

  console.log('─'.repeat(82));

  if (allPassed) {
    console.log(`\n${GREEN}${BOLD}🎉 ALL SYSTEMS OPERATIONAL: 100% OF FEATURES VERIFIED & PASSED!${RESET}\n`);
  } else {
    console.log(`\n${RED}${BOLD}⚠ SOME TESTS FAILED — Review logs above for details.${RESET}\n`);
    process.exit(1);
  }
}

// ── Main Entrypoint ─────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  console.log(`\n${BOLD}==============================================================================${RESET}`);
  console.log(`${BOLD}           FLUXCAST COMPREHENSIVE TEST EXECUTOR & EVALUATOR                   ${RESET}`);
  console.log(`${BOLD}==============================================================================${RESET}`);

  // 1. Mandatory DB Pre-flight
  await checkDatabaseConnection();

  // 2. Run Jest Test Suites
  const jestPassed = runJestSuites();

  // 3. Run Python Proxy Tests
  const proxyPassed = runProxyTests();

  // 4. Feature Evaluation Matrix
  printFeatureMatrix(jestPassed, proxyPassed);

  const durationSec = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Total execution time: ${durationSec}s\n`);
}

main().catch(err => {
  console.error(`${RED}Fatal error during test execution:${RESET}`, err);
  process.exit(1);
});
