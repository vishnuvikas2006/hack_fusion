'use strict';

const { escapeHtml } = require('./utils');

function compactRun(run) {
  if (!run) return null;
  return JSON.parse(JSON.stringify(run));
}

function baseMarkdownReport(run) {
  const rows = run.claims.map((claim) => `| ${claim.id} | ${claim.text.replaceAll('|', '\\|')} | ${claim.agreement.supporters}/${claim.agreement.total} | ${claim.status} | ${claim.confidence}% |`).join('\n');
  const evidence = run.evidence.map((item) => `- **${item.id} — ${item.title}** (${item.type}, ${item.relation}): ${item.excerpt}`).join('\n') || '- No evidence items retrieved.';
  return `# Verification Report — ${run.id}\n\n**Started:** ${run.startedAt}  \n**Completed:** ${run.completedAt || 'In progress'}  \n**Decision:** ${run.decision?.title || 'RUNNING'}  \n**Confidence:** ${run.confidence?.score ?? '—'}%\n\n## Original Task\n\n${run.task.text}\n\n## Final Answer\n\n${run.finalAnswer?.conclusion || 'In progress'}\n\n## Decision Rationale\n\n${run.decision?.reason || 'In progress'}\n\n## Claim Matrix\n\n| Claim | Text | Model agreement | Status | Confidence |\n| --- | --- | --- | --- | --- |\n${rows || '| — | No claims | — | — | — |'}\n\n## Evidence\n\n${evidence}\n\n## Verification Checks\n\n${run.checks.map((check) => `- **${check.type}: ${check.status.toUpperCase()}** — ${check.detail}`).join('\n')}\n\n## Corrections\n\n${run.corrections.length ? run.corrections.map((item) => `- Attempt ${item.attempt}: ${item.action} (${item.reverified ? 're-verified' : 'pending'})`).join('\n') : '- No correction loop was required.'}\n\n## Audit Metadata\n\n\`\`\`json\n${JSON.stringify(run.metadata, null, 2)}\n\`\`\`\n`;
}

function markdownReport(run) {
  const ledger = (run.agentLedger || []).map((agent) => `- **${agent.role} — ${String(agent.status || 'unknown').toUpperCase()}**: ${agent.detail || agent.responsibility || 'No detail recorded.'}`).join('\n') || '- Agent ledger is not available for this historical run.';
  return baseMarkdownReport(run).replace('\n\n## Claim Matrix', `\n\n## Agent Ledger\n\n${ledger}\n\n## Claim Matrix`);
}

function htmlReport(run) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(run.id)} verification report</title><style>body{font:14px system-ui;color:#0f172a;max-width:960px;margin:48px auto;padding:0 24px}h1{font-size:28px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border:1px solid #e2e8f0;text-align:left}code{background:#f1f5f9;padding:3px}</style></head><body><h1>Verification Report</h1><p><strong>${escapeHtml(run.decision?.title || 'RUNNING')}</strong> · ${escapeHtml(run.id)} · ${escapeHtml(String(run.confidence?.score ?? '—'))}% confidence</p><h2>Final answer</h2><p>${escapeHtml(run.finalAnswer?.conclusion || 'In progress')}</p><h2>Claim matrix</h2><table><tr><th>Claim</th><th>Status</th><th>Confidence</th><th>Text</th></tr>${run.claims.map((claim) => `<tr><td>${escapeHtml(claim.id)}</td><td>${escapeHtml(claim.status)}</td><td>${escapeHtml(String(claim.confidence))}%</td><td>${escapeHtml(claim.text)}</td></tr>`).join('')}</table><h2>Decision rationale</h2><p>${escapeHtml(run.decision?.reason || '')}</p></body></html>`;
}

module.exports = { compactRun, markdownReport, htmlReport };
