'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { config, publicConfig, updateProviderSettings } = require('./config');
const { gatewayForRuntime } = require('./modelGateway');
const { RunStore } = require('./store');
const { compactRun, markdownReport, htmlReport } = require('./report');
const { SCENARIOS, parseTask, createRun, executeRun, redTeamAssessment } = require('./pipeline');
const { evaluationDataset, GOLDEN_CASES, analytics } = require('./evaluation');
const { id, now, redactSecrets } = require('./utils');

const store = new RunStore();
const publicDirectory = path.resolve(__dirname, '..', 'public');
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const rateBuckets = new Map();

function structuredLog(entry) { console.log(JSON.stringify({ timestamp: now(), ...entry })); }

function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://www.google.com https://cdn.simpleicons.org; base-uri 'self'; form-action 'self'");
}

function sendJson(response, status, payload) {
  securityHeaders(response); response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(payload));
}

function sendText(response, status, content, type = 'text/plain; charset=utf-8', headers = {}) {
  securityHeaders(response); response.writeHead(status, { 'Content-Type': type, ...headers }); response.end(content);
}

function clientAllowed(request) {
  const key = request.socket.remoteAddress || 'unknown';
  const current = Date.now();
  const entry = rateBuckets.get(key) || { since: current, count: 0 };
  if (current - entry.since > 60000) { entry.since = current; entry.count = 0; }
  entry.count += 1; rateBuckets.set(key, entry);
  return entry.count <= 100;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = ''; let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      const maximum = Math.max(1_500_000, config.maxFileBytes * 5 * 1.5 + config.maxInputChars + 50_000);
      if (size > maximum) { reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 })); request.destroy(); return; }
      raw += chunk;
    });
    request.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 })); } });
    request.on('error', reject);
  });
}

function requireAdmin(request) {
  if (!config.adminToken) return false;
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  return token === config.adminToken;
}

function isLoopback(request) {
  const address = String(request.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}

async function serveStatic(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(publicDirectory, requested);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`) && filePath !== path.join(publicDirectory, 'index.html')) return sendText(response, 403, 'Forbidden');
  try {
    const content = await fs.readFile(filePath);
    // The interface is a small single-page app. Disable asset caching so a local
    // server restart cannot leave a browser running an older home-page bundle.
    securityHeaders(response); response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store, max-age=0, must-revalidate' }); response.end(content);
  } catch { sendText(response, 404, 'Not found'); }
}

function streamEvents(request, response, runId) {
  if (!store.get(runId)) return sendJson(response, 404, { error: 'Run not found.' });
  securityHeaders(response);
  response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store', Connection: 'keep-alive' });
  let cursor = Number.parseInt(new URL(request.url, 'http://localhost').searchParams.get('after') || '0', 10) || 0;
  const flush = () => {
    const events = store.eventSlice(runId, cursor);
    for (const event of events) { cursor = event.sequence; response.write(`id: ${event.sequence}\nevent: progress\ndata: ${JSON.stringify(event)}\n\n`); }
    const run = store.get(runId);
    if (run?.status === 'complete' || run?.status === 'failed') { response.write(`event: complete\ndata: ${JSON.stringify({ id: runId, status: run.status })}\n\n`); clearInterval(timer); response.end(); }
  };
  const timer = setInterval(flush, 350); flush();
  request.on('close', () => clearInterval(timer));
}

async function handleApi(request, response, url, requestId) {
  const { pathname, searchParams } = url;
  if (request.method === 'GET' && pathname === '/api/health') return sendJson(response, 200, { status: 'ok', requestId, mode: config.openRouterKey ? 'openrouter' : config.geminiKey || config.openAiKey ? 'direct-provider' : config.demoMode ? 'deterministic-demo-fallback' : 'no-model-gateway', time: now() });
  if (request.method === 'GET' && pathname === '/api/config') return sendJson(response, 200, publicConfig());
  if (request.method === 'GET' && pathname === '/api/scenarios') return sendJson(response, 200, { scenarios: SCENARIOS });
  if (request.method === 'GET' && pathname === '/api/models') {
    try {
      const gateway = gatewayForRuntime();
      const source = config.openRouterKey ? 'openrouter-discovery' : config.geminiKey || config.openAiKey ? 'direct-provider-registry' : 'deterministic-demo-registry';
      return sendJson(response, 200, { models: await gateway.registry(searchParams.get('refresh') === 'true'), source });
    }
    catch (error) { return sendJson(response, 503, { error: 'Model discovery is currently unavailable. Existing configured models remain visible.', detail: redactSecrets(error.message) }); }
  }
  if (request.method === 'POST' && pathname === '/api/settings/providers') {
    if (!isLoopback(request) && !requireAdmin(request)) return sendJson(response, 403, { error: 'Provider keys can only be changed from the server host.' });
    try {
      const settings = updateProviderSettings(await readJson(request));
      return sendJson(response, 200, { config: settings });
    } catch (error) { return sendJson(response, 400, { error: redactSecrets(error.message || 'Provider settings could not be saved.') }); }
  }
  if (request.method === 'GET' && pathname === '/api/runs') return sendJson(response, 200, { runs: store.list() });
  if (request.method === 'POST' && pathname === '/api/runs') {
    const task = parseTask(await readJson(request));
    const run = store.create(createRun(task));
    structuredLog({ requestId, runId: run.id, event: 'run_started', taskTypes: task.categories, poolMode: task.poolMode });
    executeRun({ run, gateway: gatewayForRuntime(), publish: (runId, event) => store.publish(runId, event) }).then(() => structuredLog({ requestId, runId: run.id, event: 'run_completed', status: run.status, decision: run.decision?.title }));
    return sendJson(response, 202, { runId: run.id, status: 'running', eventsUrl: `/api/runs/${run.id}/events` });
  }
  const actionMatch = pathname.match(/^\/api\/runs\/([^/]+)\/(attack|review|replay)$/);
  if (request.method === 'POST' && actionMatch) {
    const [, runId, action] = actionMatch;
    const run = store.get(runId);
    if (!run) return sendJson(response, 404, { error: 'Run not found.' });
    if (action === 'attack') {
      if (!['complete', 'failed'].includes(run.status)) return sendJson(response, 409, { error: 'Wait for the analysis to finish before challenging the answer.' });
      const result = redTeamAssessment(run.task, run.claims, run.contradictions, run.codeVerification);
      const attack = { id: id('ATTACK'), at: now(), ...result };
      run.adversarialAttacks = [...(run.adversarialAttacks || []), attack];
      run.redTeam = result;
      store.publish(run.id, { at: attack.at, stage: 'red-team', message: result.findings.length ? `${result.findings.length} adversarial finding(s) recorded` : 'Adversarial challenge found no additional issue', findings: result.findings.length, status: result.status });
      return sendJson(response, 200, { run: compactRun(run), attack });
    }
    if (action === 'review') {
      const body = await readJson(request);
      const requested = String(body.action || 'request-evidence');
      const reviewAction = ['approve', 'reject', 'request-evidence'].includes(requested) ? requested : 'request-evidence';
      run.reviewCheckpoint = { action: reviewAction, note: redactSecrets(String(body.note || '').slice(0, 600)), at: now() };
      store.publish(run.id, { at: run.reviewCheckpoint.at, stage: 'human-review', message: `Human review: ${reviewAction.replace('-', ' ')}`, status: reviewAction });
      return sendJson(response, 200, { run: compactRun(run), review: run.reviewCheckpoint });
    }
    // Replay creates an independent run with the same sanitized task and
    // current provider registry. The historical audit remains unchanged.
    const replayTask = JSON.parse(JSON.stringify(run.task));
    const replay = store.create(createRun(replayTask));
    structuredLog({ requestId, runId: replay.id, event: 'run_replayed', sourceRunId: run.id });
    executeRun({ run: replay, gateway: gatewayForRuntime(), publish: (id, event) => store.publish(id, event) }).then(() => structuredLog({ requestId, runId: replay.id, event: 'replay_completed', status: replay.status, decision: replay.decision?.title }));
    return sendJson(response, 202, { runId: replay.id, status: 'running', eventsUrl: `/api/runs/${replay.id}/events`, replayOf: run.id });
  }
  const eventMatch = pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
  if (request.method === 'GET' && eventMatch) return streamEvents(request, response, eventMatch[1]);
  const exportMatch = pathname.match(/^\/api\/runs\/([^/]+)\/export$/);
  if (request.method === 'GET' && exportMatch) {
    const run = store.get(exportMatch[1]); if (!run) return sendJson(response, 404, { error: 'Run not found.' });
    const format = searchParams.get('format') || 'json';
    if (format === 'markdown') return sendText(response, 200, markdownReport(run), 'text/markdown; charset=utf-8', { 'Content-Disposition': `attachment; filename="${run.id}-report.md"` });
    if (format === 'html') return sendText(response, 200, htmlReport(run), 'text/html; charset=utf-8', { 'Content-Disposition': `attachment; filename="${run.id}-report.html"` });
    return sendText(response, 200, JSON.stringify(compactRun(run), null, 2), 'application/json; charset=utf-8', { 'Content-Disposition': `attachment; filename="${run.id}-audit.json"` });
  }
  const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (request.method === 'GET' && runMatch) { const run = store.get(runMatch[1]); return run ? sendJson(response, 200, compactRun(run)) : sendJson(response, 404, { error: 'Run not found.' }); }
  if (request.method === 'POST' && pathname === '/api/feedback') return sendJson(response, 201, { feedback: store.addFeedback(await readJson(request)) });
  if (request.method === 'GET' && pathname === '/api/evaluation') return sendJson(response, 200, { dataset: evaluationDataset(), goldenCases: GOLDEN_CASES, metrics: analytics([...store.runs.values()]) });
  if (request.method === 'GET' && pathname === '/api/analytics') return sendJson(response, 200, analytics([...store.runs.values()]));
  if (request.method === 'GET' && pathname === '/api/admin/status') {
    if (!requireAdmin(request)) return sendJson(response, 401, { error: 'Administrative authentication is required.' });
    return sendJson(response, 200, { config: publicConfig(), runs: store.list().length, feedbackCount: store.feedback.length });
  }
  return sendJson(response, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (request, response) => {
  const requestId = id('REQ');
  const started = Date.now();
  try {
    if (!clientAllowed(request)) return sendJson(response, 429, { error: 'Too many requests. Please wait a moment and retry.' });
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url, requestId);
    else if (request.method === 'GET') await serveStatic(response, url.pathname);
    else sendJson(response, 405, { error: 'Method not allowed.' });
    structuredLog({ requestId, event: 'request_complete', method: request.method, path: url.pathname, durationMs: Date.now() - started, status: response.statusCode });
  } catch (error) {
    const status = error.statusCode || 500;
    structuredLog({ requestId, event: 'request_error', durationMs: Date.now() - started, status, error: redactSecrets(error.message || String(error)) });
    if (!response.headersSent) sendJson(response, status, { error: status === 500 ? 'The request could not be completed safely.' : error.message, requestId });
    else response.end();
  }
});

if (require.main === module) server.listen(config.port, () => structuredLog({ event: 'server_started', port: config.port, mode: config.openRouterKey ? 'openrouter' : config.geminiKey || config.openAiKey ? 'direct-provider' : config.demoMode ? 'deterministic-demo-fallback' : 'no-model-gateway' }));

module.exports = { server, store, gatewayForRuntime };
