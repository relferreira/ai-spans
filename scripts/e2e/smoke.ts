import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '../..');
const APP_DIR = path.join(ROOT_DIR, 'apps/nextjs-ai-sdk-v6-demo');
const COMPOSE_FILE = path.join(ROOT_DIR, 'docker-compose.clickhouse.yml');
const secretValues = new Set();

function log(message, context = undefined) {
  if (context) {
    console.log(`[e2e] ${message}`, context);
    return;
  }
  console.log(`[e2e] ${message}`);
}

function maskSecrets(text) {
  let out = text;
  for (const value of secretValues) {
    if (value) out = out.split(value).join('[REDACTED]');
  }
  return out;
}

function parseEnvFile(contents) {
  const env = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadAppEnv() {
  const envFile = path.join(APP_DIR, '.env.local');
  if (!existsSync(envFile)) {
    throw new Error(`Missing ${envFile}. Copy .env.local.example and fill in secrets before running npm run test:e2e.`);
  }
  const fileEnv = parseEnvFile(await readFile(envFile, 'utf8'));
  return { ...fileEnv, ...process.env };
}

function parseDatabaseUrl(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('AI_SPANS_DATABASE_URL must be a valid URL');
  }
  const dbPath = url.pathname.split('/').filter(Boolean);
  if (dbPath.length !== 1) {
    throw new Error('AI_SPANS_DATABASE_URL must include exactly one path segment for the database name');
  }
  if (!url.username || !url.password) {
    throw new Error('AI_SPANS_DATABASE_URL must include username and password');
  }
  return {
    baseUrl: `${url.protocol}//${url.host}`,
    database: decodeURIComponent(dbPath[0]),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

async function runCommand(command, args, options = {}) {
  const { cwd = ROOT_DIR, env = process.env } = options;
  log(`Run: ${command} ${args.join(' ')}`);
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `Command failed (${code}): ${command} ${args.join(' ')}\n${maskSecrets(stdout)}\n${maskSecrets(stderr)}`.trim(),
        ),
      );
    });
  });
}

function startProcess(command, args, options = {}) {
  const { cwd = ROOT_DIR, env = process.env, name = command } = options;
  log(`Start: ${command} ${args.join(' ')}`);
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${maskSecrets(chunk.toString())}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${maskSecrets(chunk.toString())}`);
  });
  return child;
}

async function stopProcess(child, name) {
  if (!child || child.exitCode != null) return;
  log(`Stopping ${name}`);
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(10_000).then(() => false),
  ]);
  if (exited) return;
  log(`${name} did not stop after SIGTERM, sending SIGKILL`);
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
  await new Promise((resolve) => child.once('exit', () => resolve(undefined)));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function findFreePort(preferredPort = undefined) {
  const tryListen = (port) =>
    new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          server.close(() => reject(new Error('Failed to resolve test port')));
          return;
        }
        const chosenPort = address.port;
        server.close((error) => {
          if (error) reject(error);
          else resolve(chosenPort);
        });
      });
    });

  if (preferredPort) return await tryListen(preferredPort);
  return await tryListen(0);
}

async function waitForHttp(url, options = {}) {
  const { timeoutMs = 90_000, intervalMs = 1_000, predicate, abortIf } = options;
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    if (abortIf) {
      const abortReason = abortIf();
      if (abortReason) {
        throw new Error(`Aborted waiting for ${url}: ${abortReason}`);
      }
    }
    try {
      const response = await fetchWithTimeout(url, {}, 5_000);
      const body = await response.text();
      if (response.ok && (!predicate || predicate({ response, body }))) {
        return { response, body };
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function waitForClickHouse(db, timeoutMs = 60_000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await clickHouseQueryText(db, 'SELECT 1');
      if (result === '1') return;
      lastError = new Error(`Unexpected response: ${result}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for ClickHouse: ${String(lastError)}`);
}

function clickHouseAuthHeaders(db) {
  const token = Buffer.from(`${db.user}:${db.password}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

async function clickHouseQueryText(db, sql) {
  const queryUrl = new URL('/', db.baseUrl);
  queryUrl.searchParams.set('database', db.database);
  queryUrl.searchParams.set('query', sql);
  const response = await fetchWithTimeout(
    queryUrl.toString(),
    {
      headers: clickHouseAuthHeaders(db),
    },
    10_000,
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`ClickHouse query failed (${response.status}): ${sql}\n${text}`);
  }
  return text.trim();
}

async function getSpanCountForFunction(db, functionId) {
  const tableExists = await clickHouseQueryText(db, 'EXISTS TABLE ai_sdk_spans_v1');
  if (tableExists !== '1') return 0;
  const escaped = functionId.replaceAll("'", "''");
  const count = await clickHouseQueryText(
    db,
    `SELECT count() FROM ai_sdk_spans_v1 WHERE function_id = '${escaped}'`,
  );
  return Number.parseInt(count, 10);
}

async function waitForSpanCountIncrease(db, functionId, baseline, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const count = await getSpanCountForFunction(db, functionId);
    if (Number.isFinite(count) && count > baseline) return count;
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for ClickHouse rows for function_id=${functionId} to exceed baseline ${baseline}`);
}

async function postChatMessage(port, prompt) {
  const payload = {
    userId: 'e2e_user',
    sessionId: `e2e_session_${Date.now()}`,
    messages: [
      {
        id: `msg-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text: prompt }],
      },
    ],
  };
  const response = await fetchWithTimeout(
    `http://127.0.0.1:${port}/api/chat`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    90_000,
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Chat API failed (${response.status}): ${body.slice(0, 1000)}`);
  }
  if (!body) {
    throw new Error('Chat API returned empty body');
  }
  return body;
}

async function main() {
  const appEnv = await loadAppEnv();
  if (!appEnv.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY in process env or app .env.local');
  }
  if (!appEnv.AI_SPANS_DATABASE_URL) {
    throw new Error('Missing AI_SPANS_DATABASE_URL in process env or app .env.local');
  }
  secretValues.add(appEnv.ANTHROPIC_API_KEY);
  secretValues.add(appEnv.AI_SPANS_DATABASE_URL);

  const db = parseDatabaseUrl(appEnv.AI_SPANS_DATABASE_URL);
  secretValues.add(db.password);
  const composeEnv = {
    ...process.env,
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || db.password,
  };
  secretValues.add(composeEnv.CLICKHOUSE_PASSWORD);

  await runCommand('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d'], { cwd: ROOT_DIR, env: composeEnv });
  await waitForClickHouse(db, 60_000);

  await runCommand('npm', ['run', 'build', '-w', 'ai-spans'], { cwd: ROOT_DIR });

  const baseline = await getSpanCountForFunction(db, 'chat.stream');
  log('Baseline ClickHouse row count for chat.stream', { baseline });

  const requestedPort = process.env.AI_SPANS_E2E_PORT ? Number(process.env.AI_SPANS_E2E_PORT) : undefined;
  const port = await findFreePort(requestedPort);
  log('Using demo port', { port });
  const demoProcess = startProcess('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: APP_DIR,
    env: { ...process.env, ...appEnv, PORT: String(port) },
    name: 'demo',
  });

  let demoExitedEarly = false;
  demoProcess.once('exit', (code) => {
    if (code !== 0) demoExitedEarly = true;
  });

  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, {
      timeoutMs: 120_000,
      predicate: ({ body }) => body.includes('AI SDK v6 + Anthropic + ai-spans'),
      abortIf: () => (demoExitedEarly ? 'demo server exited before becoming ready' : false),
    });

    const prompt = `Reply with exactly this text: ai-spans-smoke-${Date.now()}`;
    await postChatMessage(port, prompt);
    log('Chat API request completed');

    const afterCount = await waitForSpanCountIncrease(db, 'chat.stream', baseline, 45_000);
    log('ClickHouse row count increased', { baseline, afterCount });

    const ui = await fetchWithTimeout(`http://127.0.0.1:${port}/admin/ai-observability`, {}, 30_000);
    const uiHtml = await ui.text();
    if (!ui.ok) {
      throw new Error(`Observability page failed (${ui.status})`);
    }
    if (!uiHtml.includes('AI Observability') || !uiHtml.includes('Recent Observations')) {
      throw new Error('Observability page did not contain expected content');
    }
    log('Observability UI rendered successfully');
  } finally {
    await stopProcess(demoProcess, 'demo');
  }

  log('Smoke e2e passed');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(maskSecrets(String(error?.stack || error)));
    process.exit(1);
  });
