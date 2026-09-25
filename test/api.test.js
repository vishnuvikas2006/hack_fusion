'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Keep integration tests deterministic and prevent them from calling a developer's live account.
process.env.OPENROUTER_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.OPENAI_API_KEY = '';
const { server } = require('../src/server');

let baseUrl;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

test('health endpoint never exposes server secrets', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(Object.hasOwn(body, 'openRouterKey'), false);
});

test('home page serves the three-pane conversation workspace', async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /id="app"/);
});

test('run endpoint returns a streamable audit ID and completed report', async () => {
  const created = await fetch(`${baseUrl}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'What is 25 * 48?', scenario: 'simple', mode: 'Math' }) });
  assert.equal(created.status, 202);
  const { runId } = await created.json();
  let run;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    run = await (await fetch(`${baseUrl}/api/runs/${runId}`)).json();
    if (run.status !== 'running') break;
  }
  assert.equal(run.status, 'complete');
  assert.equal(run.decision.status, 'verified');
  const report = await fetch(`${baseUrl}/api/runs/${runId}/export?format=markdown`);
  assert.equal(report.status, 200);
  assert.match(await report.text(), /Verification Report/);
});

test('completed runs support auditable challenge, human review, and replay actions', async () => {
  const created = await fetch(`${baseUrl}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'What is 25 * 48?', scenario: 'simple', mode: 'Math', verificationMode: 'quick' }) });
  const { runId } = await created.json();
  let run;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    run = await (await fetch(`${baseUrl}/api/runs/${runId}`)).json();
    if (run.status !== 'running') break;
  }
  assert.equal(run.status, 'complete');
  const attack = await fetch(`${baseUrl}/api/runs/${runId}/attack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(attack.status, 200);
  assert.ok(Array.isArray((await attack.json()).attack.findings));
  const review = await fetch(`${baseUrl}/api/runs/${runId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request-evidence' }) });
  assert.equal(review.status, 200);
  assert.equal((await review.json()).review.action, 'request-evidence');
  const replay = await fetch(`${baseUrl}/api/runs/${runId}/replay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(replay.status, 202);
  assert.notEqual((await replay.json()).runId, runId);
});

test('invalid input gets a clear 400 response', async () => {
  const response = await fetch(`${baseUrl}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: '' }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Enter a task/);
});
