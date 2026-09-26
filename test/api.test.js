'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Keep integration tests deterministic and prevent them from calling a developer's live account.
process.env.OPENROUTER_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.OPENAI_API_KEY = '';
const { server } = require('../src/server');

let baseUrl;

function pdfFixture(text) {
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n(${text}) Tj\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body).toString('base64');
}

async function completedRun(runId) {
  let run;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    run = await (await fetch(`${baseUrl}/api/runs/${runId}`)).json();
    if (run.status !== 'running') break;
  }
  return run;
}

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
  assert.ok(Array.isArray(run.agentLedger));
  assert.ok(run.agentLedger.some((agent) => agent.role === 'planner'));
  const report = await fetch(`${baseUrl}/api/runs/${runId}/export?format=markdown`);
  assert.equal(report.status, 200);
  const reportText = await report.text();
  assert.match(reportText, /Verification Report/);
  assert.match(reportText, /Agent Ledger/);
});

test('a PDF upload is locally reduced to extracted text before analysis', async () => {
  const created = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'Summarize the attached document.', mode: 'Document', documents: [{ name: 'sample.pdf', type: 'application/pdf', fileData: pdfFixture('Project Apollo status is green.') }] })
  });
  assert.equal(created.status, 202);
  const { runId } = await created.json();
  const run = await completedRun(runId);
  assert.equal(run.status, 'complete');
  assert.match(run.task.documents[0].content, /Project Apollo status is green/);
  assert.equal(Object.hasOwn(run.task.documents[0], 'fileData'), false);
});

test('every rendered UI action has a handler and Code appears once in the composer', () => {
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const progressStyles = fs.readFileSync(require.resolve('../public/progress.css'), 'utf8');
  const actions = new Set([...app.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]));
  const handlers = new Set([...app.matchAll(/action === '([^']+)'/g)].map((match) => match[1]));
  for (const action of actions) assert.ok(handlers.has(action), `Missing click handler for ${action}.`);
  const composer = app.match(/function studioComposer\(\) \{([\s\S]*?)\n\}\n\nfunction studioModelPanel/);
  assert.ok(composer);
  assert.equal((composer[1].match(/data-action="code-mode"/g) || []).length, 1);
  assert.match(app, /class="insight-card action-center-card"/);
  assert.match(app, /state\.pendingAction/);
  assert.match(app, /class="back-home" data-action="navigate" data-page="home"/);
  assert.match(progressStyles, /\.result-action-grid/);
});

test('the UI shows approximate green confidence bands without changing audit scores', () => {
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const styles = fs.readFileSync(require.resolve('../public/overrides.css'), 'utf8');
  assert.match(app, /const DISPLAY_CONFIDENCE_FLOOR = 50/);
  assert.match(app, /Math\.max\(DISPLAY_CONFIDENCE_FLOOR/);
  assert.match(app, /Math\.round\(bounded \/ 5\) \* 5/);
  assert.match(app, /~\$\{displayedConfidence\(answer\.confidence\)\}% confidence/);
  assert.match(app, /displayedConfidence\(run\.confidence\?\.score\)/);
  assert.match(styles, /\.confidence-display\{color:#15803d!important/);
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
  const attackPayload = await attack.json();
  assert.ok(Array.isArray(attackPayload.attack.findings));
  assert.equal(attackPayload.run.adversarialAttacks.length, 1);
  for (const action of ['approve', 'request-evidence', 'reject']) {
    const review = await fetch(`${baseUrl}/api/runs/${runId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    assert.equal(review.status, 200);
    const payload = await review.json();
    assert.equal(payload.review.action, action);
    assert.equal(payload.run.reviewCheckpoint.action, action);
  }
  const reviewedRun = await (await fetch(`${baseUrl}/api/runs/${runId}`)).json();
  assert.deepEqual(reviewedRun.humanReviews.map((review) => review.action), ['approve', 'request-evidence', 'reject']);
  const replay = await fetch(`${baseUrl}/api/runs/${runId}/replay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(replay.status, 202);
  const replayPayload = await replay.json();
  assert.notEqual(replayPayload.runId, runId);
  assert.equal((await completedRun(replayPayload.runId)).status, 'complete');
});

test('invalid input gets a clear 400 response', async () => {
  const response = await fetch(`${baseUrl}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: '' }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Enter a task/);
});
