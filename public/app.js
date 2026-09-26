'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const toastRegion = $('#toast-region');
const state = {
  page: 'home', config: null, models: [], scenarios: [], runs: [], analytics: null,
  activeRun: null, events: [], modal: null, labFilter: 'all', menuOpen: false, evaluation: null,
  soundEnabled: true, soundedStages: new Set(), audioContext: null, pendingAction: null,
  draft: { task: '', mode: 'Ask', poolMode: 'smart', verificationMode: 'balanced', files: [], customModels: [] }
};

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const statusClass = (value = '') => String(value).toLowerCase().replaceAll(' ', '-');
const titleCase = (value = '') => String(value).replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const homeDecisionLabel = (decision = {}) => decision.status === 'needs-more-evidence' ? 'Limited result' : decision.title || 'Complete';
const DISPLAY_CONFIDENCE_FLOOR = 50;
const displayedConfidence = (value) => {
  const raw = Number(value);
  const bounded = Math.min(95, Math.max(DISPLAY_CONFIDENCE_FLOOR, Number.isFinite(raw) ? raw : DISPLAY_CONFIDENCE_FLOOR));
  return Math.round(bounded / 5) * 5;
};
const icon = (name = 'spark') => {
  const paths = {
    spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.5 8.4-8 10-4.5-1.6-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-4.8"/>',
    code: '<path d="m8 9-3 3 3 3"/><path d="m16 9 3 3-3 3"/><path d="m14 5-4 14"/>',
    document: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    chart: '<path d="M4 19V5M4 19h17"/><path d="M8 16v-4M12 16V7M16 16v-7M20 16v-11"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.15 2.15-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20h-3v-.08A1.7 1.7 0 0 0 10.62 18.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.15-2.15.06-.06A1.7 1.7 0 0 0 6.93 14.7 1.7 1.7 0 0 0 5.37 13.66H5v-3h.37a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.15-2.15.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.66 4.37V4h3v.37a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.15 2.15-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04H21v3h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    lab: '<path d="M9 3h6M10 3v6l-5.5 8a3 3 0 0 0 2.5 4h10a3 3 0 0 0 2.5-4L14 9V3"/><path d="M8 15h8"/>',
    brain: '<path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v.5A3.5 3.5 0 0 0 4 15a3.5 3.5 0 0 0 5.5 2.9"/><path d="M14.5 4.5A3.5 3.5 0 0 1 18 8v.5A3.5 3.5 0 0 1 20 15a3.5 3.5 0 0 1-5.5 2.9"/><path d="M12 4v16M8 10h4M12 14h4"/>',
    network: '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.2 10.8 7-3.6M8.2 13.2l7 3.6"/>',
    searchdoc: '<path d="M6 3h8l4 4v7"/><path d="M14 3v5h5M9 13h3"/><circle cx="15" cy="17" r="3.5"/><path d="m17.5 19.5 3 3"/>',
    swap: '<path d="M4 7h13"/><path d="m14 3 4 4-4 4M20 17H7"/><path d="m10 13-4 4 4 4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
};

const modelIsAvailable = (model) => model?.status === 'available' || model?.status === 'demo-ready';
function availabilityDescription(model) {
  if (modelIsAvailable(model)) return model?.adapter === 'gemini-direct' ? 'Key and model verified; generation quota is checked when a run starts' : 'API access verified';
  const descriptions = {
    'api-key-not-configured': 'API key is missing',
    'api-key-invalid-or-expired': 'API key is invalid, expired, or revoked',
    'provider-rate-limited': 'Provider is rate limited; try again shortly',
    'provider-daily-quota-exhausted': 'Provider daily quota is exhausted; wait for reset or increase quota',
    'configured-model-not-available': 'Configured model is not available to this key',
    'provider-health-check-failed': 'Provider could not be reached for a health check',
    'verification-pending': 'API key verification is still pending',
    'requires-openrouter-credit': 'OpenRouter credit is required',
    'not-currently-available': 'Model is not currently available',
    'discovery-unavailable': 'Provider model discovery is unavailable'
  };
  return descriptions[model?.availabilityReason] || 'Provider is unavailable';
}
const providerDomain = (provider = '') => {
  const value = provider.toLowerCase();
  if (value.includes('openai')) return 'openai.com';
  if (value.includes('gemini') || value.includes('gemma')) return 'gemini.google.com';
  if (value.includes('anthropic') || value.includes('claude')) return 'anthropic.com';
  if (value.includes('nvidia')) return 'nvidia.com';
  if (value.includes('cohere')) return 'cohere.com';
  if (value.includes('qwen')) return 'qwen.ai';
  if (value.includes('deepgram')) return 'deepgram.com';
  if (value.includes('poolside')) return 'poolside.ai';
  if (value.includes('inclusion')) return 'inclusionai.com';
  if (value.includes('nexagi')) return 'nexagi.com';
  if (value.includes('thinking machine')) return 'tngtech.com';
  if (value.includes('dots')) return 'dots.studio';
  if (value.includes('z.ai')) return 'z.ai';
  return 'openrouter.ai';
};
function modelLogo(model, compact = false) {
  const initials = model.provider.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'AI';
  // Provider favicons are fetched directly from the public internet. A visible
  // initials fallback remains underneath for offline use or a missing provider mark.
  const imageUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(providerDomain(model.provider))}&sz=128`;
  return `<span class="model-logo ${compact ? 'compact' : ''}" aria-hidden="true"><b>${esc(initials)}</b><img src="${imageUrl}" alt="" referrerpolicy="no-referrer" loading="lazy"></span>`;
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'A request could not be completed.'); }
  return response.json();
}

function toast(message) {
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = message; toastRegion.append(item);
  setTimeout(() => item.remove(), 3400);
}

function completedRunId() {
  const runId = state.activeRun?.id;
  if (!runId || runId === 'RUN-PENDING') throw new Error('Wait for the analysis to finish before using a result action.');
  return runId;
}

async function refreshRunState(runId, fallbackRun) {
  const [run, runs, analytics] = await Promise.all([
    api(`/api/runs/${encodeURIComponent(runId)}`).catch(() => fallbackRun),
    api('/api/runs').catch(() => ({ runs: state.runs })),
    api('/api/analytics').catch(() => state.analytics)
  ]);
  if (run) state.activeRun = run;
  if (runs?.runs) state.runs = runs.runs;
  if (analytics) state.analytics = analytics;
}

const progressStage = {
  'task-analysis': 'task-analysis', planning: 'planning', 'model-routing': 'generation', generation: 'generation', 'model-fallback': 'generation', 'claim-extraction': 'generation', evidence: 'evidence', verification: 'verification', sandbox: 'verification', contradiction: 'contradiction', correction: 'correction', 'red-team': 'red-team', 'gemini-review': 'finalization', finalization: 'finalization'
};

function unlockProgressSound() {
  if (!state.soundEnabled || state.audioContext) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    state.audioContext = new Audio();
    state.audioContext.resume?.();
  } catch { state.soundEnabled = false; }
}

function playProgressSound(stage) {
  if (!state.soundEnabled || !state.audioContext || document.hidden) return;
  try {
    const context = state.audioContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const finalStage = stage === 'finalization';
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(finalStage ? 740 : 520, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(finalStage ? 1040 : 690, context.currentTime + (finalStage ? 0.15 : 0.08));
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (finalStage ? 0.2 : 0.11));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + (finalStage ? 0.21 : 0.12));
  } catch { /* Sound is an enhancement; progress remains available without it. */ }
}

function notifyProgress(event) {
  const stage = progressStage[event.stage];
  if (!stage || state.soundedStages.has(stage)) return;
  state.soundedStages.add(stage);
  playProgressSound(stage);
}

function pageShell(content) {
  const nav = [['settings', 'Settings']];
  return `<header class="top-nav"><div class="nav-inner"><button class="brand" data-action="navigate" data-page="home" aria-label="HackFusion home"><span class="brand-mark">${icon('spark')}</span><span><span class="brand-name">HACKFUSION</span><span class="brand-sub">Multi-Talented Agent</span></span></button><button class="back-home" data-action="navigate" data-page="home" aria-label="Return to home page">← Back to home</button><nav class="nav-links" aria-label="Primary navigation">${nav.map(([id, label]) => `<button class="nav-link ${state.page === id ? 'active' : ''}" data-action="navigate" data-page="${id}">${label}</button>`).join('')}</nav><button class="nav-menu" data-action="toggle-menu" aria-label="Open navigation">Menu</button><span class="avatar" aria-label="Demo administrator">HF</span></div></header>${state.menuOpen ? `<div class="container"><div class="card" style="padding:10px;margin-top:10px"><button class="back-home" data-action="navigate" data-page="home">← Back to home</button>${nav.map(([id,label]) => `<button class="nav-link ${state.page===id?'active':''}" data-action="navigate" data-page="${id}">${label}</button>`).join('')}</div></div>` : ''}<main id="main-content" class="main"><div class="container">${content}</div></main>`;
}

function demoBanner() {
  if (!state.config?.demoMode) return '';
  return `<div class="banner demo"><span>${icon('lab')}</span><div><strong>Deterministic demo fallback</strong>OpenRouter is not configured on this server. Demo responses are labeled simulation; they are never presented as live model output.</div></div>`;
}

function hero() {
  return `<section class="hero"><div><p class="eyebrow">Welcome to</p><h1>HACKFUSION <span>Multi-Talented Agent</span></h1><p>Multi-model reasoning, verification and reliability.</p><div class="hero-stats"><div><div class="stat-number">${state.models.length || 12}</div><div class="stat-label">Models</div></div><div><div class="stat-number">6</div><div class="stat-label">Agents</div></div><div><div class="stat-number">1</div><div class="stat-label">Verification Engine</div></div></div></div><div class="hero-actions"><div class="mini-flow"><span><i class="flow-dot"></i> Generate</span><span><i class="flow-dot"></i> Verify</span><span><i class="flow-dot"></i> Correct</span></div><div class="stack"><button class="button-primary" data-action="scroll-workspace">Try a Demo</button><button class="button-secondary" data-action="show-architecture">View Architecture</button></div></div></section>`;
}

function taskWorkspace() {
  const modes = ['Ask', 'Research', 'Code', 'Document', 'Math'];
  const hint = { Ask: 'Ask anything...', Research: 'Ask a research question to verify...', Code: 'Paste code or describe the program to verify...', Document: 'Add a text document and ask what to verify...', Math: 'Enter a calculation or equation...' }[state.draft.mode];
  const selectedCount = state.draft.poolMode === 'custom' ? state.draft.customModels.length : state.draft.poolMode === 'full' ? state.models.filter((model) => model.status !== 'disabled').length : state.config?.limits?.modelCount || 5;
  return `<section id="workspace" class="workspace card section"><div class="task-tabs" role="tablist" aria-label="Task type">${modes.map((mode) => `<button class="task-tab ${state.draft.mode === mode ? 'active' : ''}" role="tab" aria-selected="${state.draft.mode === mode}" data-action="mode" data-mode="${mode}">${mode}</button>`).join('')}</div><div class="task-body"><label class="hidden" for="task-input">Task</label><textarea id="task-input" maxlength="${state.config?.limits?.maxInputChars || 16000}" placeholder="${hint}">${esc(state.draft.task)}</textarea>${state.draft.files.length ? `<div class="attached-files">${state.draft.files.map((file, index) => `<span class="file-chip">${esc(file.name)} <button data-action="remove-file" data-index="${index}" aria-label="Remove ${esc(file.name)}">×</button></span>`).join('')}</div>` : ''}<div class="task-toolbar"><div class="select-wrap"><select id="pool-mode" aria-label="Model pool"><option value="smart" ${state.draft.poolMode === 'smart' ? 'selected' : ''}>Smart Pool</option><option value="full" ${state.draft.poolMode === 'full' ? 'selected' : ''}>Full Pool</option><option value="custom" ${state.draft.poolMode === 'custom' ? 'selected' : ''}>Custom Pool</option></select></div><button class="button-secondary small" data-action="select-models">Select Models (${selectedCount})</button><label class="file-button">Add file or image<input id="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.markdown,.json,.csv,.pdf,.docx,text/plain,text/markdown,application/json,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple></label><button class="button-primary" data-action="run">Run Analysis <span aria-hidden="true">→</span></button></div></div></section>`;
}

function chatWorkspace() {
  const modes = ['Ask', 'Research', 'Code', 'Document', 'Math'];
  const hints = { Ask: 'Ask anything or upload an image to analyze...', Research: 'Ask a research question to verify...', Code: 'Paste code or describe the program to verify...', Document: 'Add a file or image and ask what to verify...', Math: 'Enter a calculation or equation...' };
  const liveModels = state.models.filter(modelIsAvailable);
  const selectedCount = state.draft.poolMode === 'custom' ? state.draft.customModels.length : state.draft.poolMode === 'full' ? liveModels.length : state.config?.limits?.modelCount || 5;
  const attachments = state.draft.files.length ? `<div class="attached-files">${state.draft.files.map((file, index) => `<span class="file-chip ${file.kind === 'image' ? 'image-file-chip' : ''}">${file.kind === 'image' ? `<img src="${esc(file.imageData)}" alt="">` : ''}${esc(file.name)} <button data-action="remove-file" data-index="${index}" aria-label="Remove ${esc(file.name)}">×</button></span>`).join('')}</div>` : '';
  const modelStrip = state.models.length ? `<div class="chat-model-strip" aria-label="Available models">${state.models.map((model) => `<button class="chat-model ${modelIsAvailable(model) ? 'available' : 'unavailable'} ${state.draft.customModels.includes(model.modelId) ? 'selected' : ''}" data-action="toggle-model" data-model-id="${esc(model.modelId)}" ${modelIsAvailable(model) ? '' : 'disabled'} title="${esc(model.provider)} — ${esc(model.availabilityReason || model.status)}">${modelLogo(model, true)}<span class="model-label">${esc(model.provider)}</span><i class="availability-dot ${modelIsAvailable(model) ? 'green' : 'red'}"></i></button>`).join('')}</div>` : '<div class="chat-model-strip loading">Loading configured models…</div>';
  return `<section id="workspace" class="chat-workspace card"><header class="chat-head"><div><p class="eyebrow">HACKFUSION</p><h1>Ask the multi-model assistant</h1><p>Available providers are selectable below. Green means available; red means a key, access, or provider capacity is unavailable.</p></div><button class="button-secondary small" data-action="navigate" data-page="settings">Provider settings</button></header><div class="chat-model-area"><div class="chat-model-title"><span>Available models</span><button class="button-tertiary small" data-action="refresh-models">Refresh</button></div>${modelStrip}</div><div class="task-body chat-body"><label class="hidden" for="task-input">Message</label><textarea id="task-input" maxlength="${state.config?.limits?.maxInputChars || 16000}" placeholder="${hints[state.draft.mode]}">${esc(state.draft.task)}</textarea>${attachments}<div class="task-toolbar"><div class="select-wrap"><select id="task-mode" aria-label="Task type">${modes.map((mode) => `<option value="${mode}" ${state.draft.mode === mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></div><div class="select-wrap"><select id="pool-mode" aria-label="Model pool"><option value="smart" ${state.draft.poolMode === 'smart' ? 'selected' : ''}>Smart routing</option><option value="full" ${state.draft.poolMode === 'full' ? 'selected' : ''}>All available</option><option value="custom" ${state.draft.poolMode === 'custom' ? 'selected' : ''}>Selected models</option></select></div><button class="button-secondary small" data-action="select-models">Select models (${selectedCount})</button><label class="file-button">Attach file or image<input id="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.markdown,.json,.csv,.pdf,.docx,text/plain,text/markdown,application/json,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple></label><button class="button-primary" data-action="run">Send <span aria-hidden="true">→</span></button></div><p class="chat-note">Image files are sent only to available vision-capable models. If a provider fails, healthy backup models are tried automatically.</p></div></section>`;
}

function modelGrid() {
  const models = state.models.slice(0, 12);
  return `<section class="models-panel card"><div class="section-heading"><div><h2>Available Models</h2><p>via OpenRouter · status is refreshed server-side</p></div><button class="button-tertiary small" data-action="refresh-models">Refresh</button></div><div class="model-grid">${models.map(modelCard).join('') || skeletonCards(8)}</div></section>`;
}

function modelCard(model) {
  return `<article class="model-card"><div class="model-top">${modelLogo(model, true)}<span class="model-name" title="${esc(model.provider)}">${esc(model.provider)}</span></div><div class="model-meta"><span class="status ${statusClass(model.status)}">${esc(model.status)}</span></div></article>`;
}

function activityPanel() {
  return `<aside class="activity-panel card"><div class="section-heading"><div><h2>Recent Activity</h2><p>Auditable runs</p></div></div>${state.runs.length ? `<div class="activity-list">${state.runs.slice(0, 5).map((run) => `<div class="activity"><div><div class="activity-title">${esc(run.task)}</div><div class="activity-meta"><span class="status ${statusClass(run.decision)}">${esc(run.decision)}</span></div></div><div class="activity-side"><button class="button-tertiary small" data-action="view-run" data-run-id="${esc(run.id)}">View</button><div class="activity-time">${timeAgo(run.startedAt)}</div></div></div>`).join('')}</div>` : `<div class="empty"><strong>No runs yet</strong>Start your first analysis.</div>`}</aside>`;
}

function scenarios() {
  return `<section class="section"><div class="section-heading"><div><h2>Try a Scenario</h2><p>Preconfigured, reproducible reliability demonstrations</p></div></div><div class="scenario-grid">${state.scenarios.map((scenario) => `<button class="scenario" data-action="scenario" data-scenario="${esc(scenario.id)}"><span class="scenario-title">${esc(scenario.title)} <span>→</span></span><p>${esc(scenario.description)}</p></button>`).join('')}</div></section>`;
}

function footer() { return `<footer class="footer"><span>HACKFUSION Multi-Talented Agent</span><span class="footer-links"><button class="button-tertiary small" data-action="show-architecture">Documentation</button><button class="button-tertiary small" data-action="show-architecture">Architecture</button><a href="#workspace">Demo</a></span></footer>`; }

function studioSidebar() {
  const recent = state.runs.slice(0, 5);
  return `<aside class="studio-sidebar"><button class="studio-brand" data-action="navigate" data-page="home"><span class="studio-brand-mark">${icon('spark')}</span><span>hack<span>fusion</span></span></button><button class="studio-new" data-action="new-conversation"><span>＋</span> New analysis <kbd>Ctrl K</kbd></button><nav class="studio-nav" aria-label="Workspace navigation"><button class="active" data-action="navigate" data-page="home">▢ <span>Conversations</span><b>${state.runs.length}</b></button><button data-action="show-architecture">□ <span>Projects</span></button><button data-action="view-activity">〽 <span>Activity</span><i class="availability-dot green"></i></button></nav><div class="studio-recent"><p>Recent</p>${recent.length ? recent.map((run) => `<button data-action="view-run" data-run-id="${esc(run.id)}"><span>${esc(String(run.task?.text || run.task || 'Untitled analysis').slice(0, 34))}</span><i>${esc(run.decision?.title || run.decision || 'running')}</i></button>`).join('') : '<div class="studio-empty-list">Your completed analyses will appear here.</div>'}</div><div class="studio-sidebar-bottom"><button data-action="navigate" data-page="settings">⚙ Settings</button><button data-action="show-architecture">⌘ How it works</button><div class="studio-user"><span>HF</span><div><b>HackFusion workspace</b><small>Local session</small></div></div></div></aside>`;
}

function studioComposer() {
  const modes = ['Ask', 'Research', 'Document', 'Math'];
  const modeSelectValue = state.draft.mode === 'Code' ? 'Ask' : state.draft.mode;
  const liveModels = state.models.filter(modelIsAvailable);
  const selectedCount = state.draft.poolMode === 'custom' ? state.draft.customModels.length : state.draft.poolMode === 'full' ? liveModels.length : state.config?.limits?.modelCount || 5;
  const attachments = state.draft.files.length ? `<div class="studio-attachments">${state.draft.files.map((file, index) => `<span>${file.kind === 'image' ? '<i>▧</i>' : '<i>⌁</i>'}${esc(file.name)}<button data-action="remove-file" data-index="${index}" aria-label="Remove ${esc(file.name)}">×</button></span>`).join('')}</div>` : '';
  return `<div class="studio-composer"><label class="hidden" for="task-input">Message</label><textarea id="task-input" maxlength="${state.config?.limits?.maxInputChars || 16000}" placeholder="Message HackFusion…">${esc(state.draft.task)}</textarea>${attachments}<div class="studio-composer-actions"><label class="studio-icon-button" title="Attach an image, PDF, DOCX, or text document">＋<input id="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.markdown,.json,.csv,.pdf,.docx,text/plain,text/markdown,application/json,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple></label><button class="studio-icon-button" data-action="select-models" title="Select models">◇</button><button class="studio-code-mode ${state.draft.mode === 'Code' ? 'active' : ''}" data-action="code-mode" aria-pressed="${state.draft.mode === 'Code'}" title="Generate code with NVIDIA in Smart routing">&lt;/&gt; Code</button><div class="select-wrap"><select id="task-mode" aria-label="Task type">${modes.map((mode) => `<option value="${mode}" ${modeSelectValue === mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></div><div class="select-wrap"><select id="pool-mode" aria-label="Model pool"><option value="smart" ${state.draft.poolMode === 'smart' ? 'selected' : ''}>Smart</option><option value="full" ${state.draft.poolMode === 'full' ? 'selected' : ''}>All available</option><option value="custom" ${state.draft.poolMode === 'custom' ? 'selected' : ''}>Selected (${selectedCount})</option></select></div><div class="select-wrap"><select id="verification-mode" aria-label="Verification depth"><option value="quick" ${state.draft.verificationMode === 'quick' ? 'selected' : ''}>Quick</option><option value="balanced" ${state.draft.verificationMode === 'balanced' ? 'selected' : ''}>Balanced</option><option value="deep" ${state.draft.verificationMode === 'deep' ? 'selected' : ''}>Deep</option><option value="maximum" ${state.draft.verificationMode === 'maximum' ? 'selected' : ''}>Maximum</option></select></div><span class="studio-send-help">Enter to send</span><button class="studio-send" data-action="run" aria-label="Send analysis">↑</button></div></div>`;
}

function studioModelPanel() {
  const completedRun = state.activeRun && ['complete', 'failed'].includes(state.activeRun.status) ? state.activeRun : null;
  const answered = completedRun ? completedRun.responses.map((response, responseIndex) => ({ response, responseIndex })).filter(({ response }) => response.status === 'success' && String(response.answer || '').trim()) : [];
  const availableCount = completedRun ? answered.length : state.models.filter(modelIsAvailable).length;
  const unavailable = state.models.filter((model) => !modelIsAvailable(model));
  const expiredCount = unavailable.filter((model) => model.availabilityReason === 'api-key-invalid-or-expired').length;
  const selected = new Set(state.draft.customModels);
  const cards = completedRun
    ? answered.length ? answered.map(({ response, responseIndex }) => {
      const model = state.models.find((item) => item.modelId === response.modelId && item.provider === response.provider) || { provider: response.provider, modelId: response.modelId, capabilities: [] };
      return `<button class="studio-model-row available" data-action="show-response" data-response="${responseIndex}" title="View this model's generated answer" aria-label="${esc(response.provider)}: view generated answer">${modelLogo(model)}<span class="studio-model-copy"><b>${esc(response.provider)}</b><small>${esc(response.modelId)}</small><em>View generated answer</em></span><i class="availability-dot green" title="Answer received"></i></button>`;
    }).join('') : '<div class="studio-panel-empty">No model returned an answer for this run.</div>'
    : state.models.length ? state.models.map((model) => {
      const detail = modelIsAvailable(model) ? (model.capabilities || []).slice(0, 3).join(' · ') || 'general' : availabilityDescription(model);
      return `<button class="studio-model-row ${modelIsAvailable(model) ? 'available' : 'unavailable'} ${selected.has(model.modelId) ? 'selected' : ''}" data-action="toggle-model" data-model-id="${esc(model.modelId)}" ${modelIsAvailable(model) ? '' : 'disabled'} title="${esc(detail)}" aria-label="${esc(model.provider)}: ${esc(detail)}">${modelLogo(model)}<span class="studio-model-copy"><b>${esc(model.provider)}</b><small>${esc(model.modelId)}</small><em>${esc(detail)}</em></span><i class="availability-dot ${modelIsAvailable(model) ? 'green' : 'red'}" title="${esc(detail)}"></i></button>`;
    }).join('') : '<div class="studio-panel-empty">Model registry is loading.</div>';
  const healthNote = completedRun ? 'Only models that generated an answer are listed.' : expiredCount ? `${expiredCount} key${expiredCount === 1 ? '' : 's'} invalid or expired` : unavailable.length ? `${unavailable.length} provider${unavailable.length === 1 ? '' : 's'} need attention` : 'All configured providers verified';
  const countLabel = completedRun ? `${availableCount} answered` : `${availableCount} available · ${Math.max(0, state.models.length - availableCount)} unavailable`;
  const intro = completedRun ? '<b>Answering models</b><small>Only models that returned a non-empty answer for this completed run are shown. Click one to view its answer.</small>' : '<b>Available models</b><small>Green = API access verified. Red = unavailable; the model row explains why.</small>';
  return `<aside class="studio-model-panel"><header><button class="studio-panel-close" data-action="refresh-models" title="Refresh availability">↻</button><p>Build preview</p><h2>${completedRun ? 'Answers' : 'Workplan'}</h2><span class="studio-model-count"><i class="availability-dot green"></i> ${countLabel}</span><span class="studio-health-note ${completedRun || (!expiredCount && !unavailable.length) ? 'healthy' : 'warning'}"><i class="availability-dot ${completedRun || (!expiredCount && !unavailable.length) ? 'green' : 'red'}"></i>${esc(healthNote)}</span></header><div class="studio-model-list"><div class="studio-workplan-intro">${intro}</div>${cards}</div><footer><span>${completedRun ? 'Click a model to inspect its full answer.' : 'Refresh checks configured API access.'}</span><button data-action="navigate" data-page="settings">Manage API keys →</button></footer></aside>`;
}

function legacyHomePage() {
  const title = state.draft.task.trim() ? 'Continue your analysis' : 'Good morning. What would you like to build today?';
  const demo = state.config?.demoMode ? `<div class="studio-demo-notice">Demo mode is active. Results are labeled as simulations until a provider key is configured.</div>` : '';
  return `<div class="studio-shell">${studioSidebar()}<main class="studio-main"><header class="studio-topbar"><div><i class="availability-dot green"></i><b>New analysis</b><span>Saved just now</span></div><button class="studio-provider-chip" data-action="navigate" data-page="settings">${state.config?.openRouterConfigured || state.config?.geminiConfigured || state.config?.openAiConfigured ? 'Providers connected' : 'Configure providers'} ⌄</button></header><section class="studio-conversation">${demo}<div class="studio-date">Today, verification workspace</div><div class="studio-message"><span class="studio-assistant-avatar">${icon('spark')}</span><div><b>HackFusion <small>now</small></b><p>${title}</p></div></div><div class="studio-message"><span class="studio-assistant-avatar">${icon('spark')}</span><div><b>HackFusion <small>now</small></b><p>I can help you analyze, research, verify, write, or turn an image or document into an evidence-backed answer.</p><div class="studio-suggestion-row"><button data-action="scenario" data-scenario="simple">⚡ Check a calculation</button><button data-action="scenario" data-scenario="conflict">▣ Verify a claim</button><button data-action="scenario" data-scenario="hallucination">⌁ Check an API fact</button></div></div></div></section>${studioComposer()}<p class="studio-footer-note">HackFusion treats attachments as untrusted data. Healthy backup providers are tried when a provider fails.</p></main>${studioModelPanel()}</div>`;
}

function studioConversation() {
  const run = state.activeRun;
  const isComplete = run && ['complete', 'failed'].includes(run.status);
  if (!isComplete) {
    const title = state.draft.task.trim() ? 'Continue your analysis' : 'Good morning. What would you like to build today?';
    return `<div class="studio-date">Today, verification workspace</div><div class="studio-message"><span class="studio-assistant-avatar">${icon('spark')}</span><div><b>HackFusion <small>now</small></b><p>${title}</p></div></div><div class="studio-message"><span class="studio-assistant-avatar">${icon('spark')}</span><div><b>HackFusion <small>now</small></b><p>I can help you analyze, research, verify, write, or turn an image or document into an evidence-backed answer.</p><div class="studio-suggestion-row"><button data-action="scenario" data-scenario="simple">⚡ Check a calculation</button><button data-action="scenario" data-scenario="conflict">▣ Verify a claim</button><button data-action="scenario" data-scenario="hallucination">⌁ Check an API fact</button></div></div></div>`;
  }
  const answer = run.finalAnswer || {};
  const decision = run.decision || {};
  const reviewNote = answer.answerKind === 'gemini-reviewed' ? `Gemini reviewed the consolidated agent output against the accepted claims.` : 'The final answer is bounded by the verification decision below.';
  return `<div class="studio-date">Completed analysis · ${esc(run.id || '')}</div><div class="studio-message studio-user-message"><span class="studio-user-avatar">You</span><div><b>You <small>submitted</small></b><p>${esc(run.task?.text || '')}</p></div></div><div class="studio-message studio-final-message"><span class="studio-assistant-avatar">${icon('spark')}</span><div class="studio-result-stack"><article class="studio-result-card"><div class="studio-result-meta"><span class="decision-badge ${statusClass(decision.status)}">${esc(homeDecisionLabel(decision))}</span><span class="confidence-display">~${displayedConfidence(answer.confidence)}% confidence</span></div><section class="studio-answer-focus" aria-labelledby="result-answer-heading"><p class="studio-answer-kicker">Answer</p><h2 id="result-answer-heading">Resultant answer</h2><div class="studio-result-answer">${esc(answer.conclusion || 'The analysis completed without a final answer.')}</div></section><div class="studio-answer-context"><p class="studio-review-note">${esc(reviewNote)}</p>${answer.limitations?.length ? `<details class="studio-limitations"><summary>Limitations and verification notes</summary><ul>${answer.limitations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></details>` : ''}<div class="studio-result-actions"><button class="button-secondary small" data-action="show-result">Open full verification record</button><button class="button-tertiary small" data-action="new-conversation">Start a new analysis</button></div></div></article></div></div>`;
}

function homePage() {
  const demo = state.config?.demoMode ? `<div class="studio-demo-notice">Demo mode is active. Results are labeled as simulations until a provider key is configured.</div>` : '';
  const providersReady = state.models.some(modelIsAvailable);
  const headerLabel = state.activeRun?.status === 'complete' ? 'Answer ready' : providersReady ? 'New analysis' : 'Provider attention required';
  const headerNote = providersReady ? 'Saved just now' : 'Check red provider dots';
  const hasCompletedResult = Boolean(state.activeRun && ['complete', 'failed'].includes(state.activeRun.status));
  return `<div class="studio-shell">${studioSidebar()}<main class="studio-main"><header class="studio-topbar"><div><i class="availability-dot ${providersReady ? 'green' : 'red'}"></i><b>${headerLabel}</b><span>${headerNote}</span></div><button class="studio-provider-chip" data-action="navigate" data-page="settings">${state.config?.openRouterConfigured || state.config?.geminiConfigured || state.config?.openAiConfigured ? 'Providers connected' : 'Configure providers'} ⌄</button></header><section class="studio-conversation ${hasCompletedResult ? 'has-result' : ''}">${demo}${studioConversation()}</section>${studioComposer()}<p class="studio-footer-note">Press Enter to send · Shift + Enter for a new line. Green dots mean API access is verified; red dots explain unavailable, expired, or rate-limited providers.</p></main>${studioModelPanel()}</div>`;
}

function pageTitle(title, description) { return `<header class="page-title"><h1>${title}</h1><p>${description}</p></header>`; }

function modelLabPage() {
  const filters = ['all', 'reasoning', 'coding', 'research', 'math', 'document'];
  const models = state.models.filter((model) => state.labFilter === 'all' || model.capabilities.includes(state.labFilter));
  return pageShell(`${pageTitle('Model Lab', 'Capability-aware routing uses configured metrics and live availability—not a universal “best model” claim.')}<div class="filter-row" role="group" aria-label="Model capability filter">${filters.map((filter) => `<button class="filter ${state.labFilter === filter ? 'active' : ''}" data-action="lab-filter" data-filter="${filter}">${titleCase(filter)}</button>`).join('')}</div><section class="model-lab-grid section">${models.map((model) => `<article class="lab-card card"><div class="lab-card-head"><div><h2>${esc(model.provider)}</h2><p>${esc(model.modelId)}</p></div><span class="status ${statusClass(model.status)}">${esc(model.status)}</span></div><div class="capabilities">${model.capabilities.map((capability) => `<span class="tag">${esc(capability)}</span>`).join('')}</div><div class="metric-lines"><div class="metric-line"><span>Verification</span><span class="meter"><span style="width:${Math.round((model.metrics?.verificationScore || 0) * 100)}%"></span></span><b>${Math.round((model.metrics?.verificationScore || 0) * 100)}%</b></div><div class="metric-line"><span>Reliability</span><span class="meter"><span style="width:${Math.round((1 - (model.metrics?.failureRate || 0)) * 100)}%"></span></span><b>${Math.round((1 - (model.metrics?.failureRate || 0)) * 100)}%</b></div><div class="metric-line"><span>Latency</span><span class="meter"><span style="width:${Math.max(6,100 - (model.metrics?.latencyMs || 0) / 30)}%"></span></span><b>${Math.round(model.metrics?.latencyMs || 0)}ms</b></div></div></article>`).join('') || `<div class="empty card"><strong>No matching models</strong>Try another capability filter.</div>`}</section>${footer()}`);
}

function analyticsPage() {
  const m = state.analytics || {};
  const outcomes = [
    ['Verified', m.tasksVerified || 0, 'verified'],
    ['Limited', m.tasksLimited || 0, 'limited'],
    ['Needs evidence', m.tasksNeedsEvidence || 0, 'needs-evidence']
  ];
  const completed = outcomes.reduce((sum, [, value]) => sum + value, 0);
  const denominator = Math.max(completed, 1);
  const [verifiedShare, limitedShare, needsEvidenceShare] = outcomes.map(([, value]) => Math.round(value / denominator * 100));
  const verifiedEnd = verifiedShare;
  const limitedEnd = Math.min(100, verifiedShare + limitedShare);
  const recentRuns = state.runs.slice(0, 5);
  const overview = [
    ['Verified runs', m.tasksVerified || 0, 'green'],
    ['Claims checked', m.claimsChecked || 0, 'blue'],
    ['Issues caught', (m.hallucinationsDetected || 0) + (m.contradictionsDetected || 0), 'orange'],
    ['Corrections', m.correctionsPerformed || 0, 'purple']
  ];
  const health = [
    ['Verification quality', `${m.averageVerificationQuality || 0}%`, m.averageVerificationQuality || 0, 'quality'],
    ['Provider success', `${Math.max(0, 100 - (m.failureRate || 0))}%`, Math.max(0, 100 - (m.failureRate || 0)), 'success'],
    ['Unsupported claims', String(m.unsupportedClaims || 0), Math.min(100, (m.unsupportedClaims || 0) * 20), 'warning'],
    ['Average latency', `${m.averageGenerationLatency || 0}ms`, Math.min(100, Math.round((m.averageGenerationLatency || 0) / 25)), 'latency']
  ];
  return pageShell(`${pageTitle('Analysis', 'A clear view of the verification work completed in this session.')}<section class="analysis-overview card"><div><p class="eyebrow">Session health</p><h2>${completed ? `${completed} completed analysis${completed === 1 ? '' : 'es'}` : 'No completed analyses yet'}</h2><p>Outcomes are based on completed audit records, not model self-reported confidence.</p></div><div class="analysis-overview-stat"><b>${m.averageVerificationQuality || 0}%</b><span>average verification quality</span></div></section><section class="analysis-kpis">${overview.map(([label, value, tone]) => `<article class="analysis-kpi card ${tone}"><span>${esc(label)}</span><b>${value}</b></article>`).join('')}</section><section class="analysis-layout"><article class="analysis-card analysis-outcomes card"><div class="analysis-card-heading"><div><h2>Run outcomes</h2><p>Decision status across completed runs</p></div><span>${completed} total</span></div><div class="outcome-content"><div class="outcome-donut" style="background:conic-gradient(#16a34a 0 ${verifiedEnd}%,#d97706 ${verifiedEnd}% ${limitedEnd}%,#64748b ${limitedEnd}% 100%)"><div><b>${completed}</b><span>runs</span></div></div><div class="outcome-list">${outcomes.map(([label, value, tone]) => `<div><i class="outcome-dot ${tone}"></i><span>${esc(label)}</span><b>${value}</b><small>${Math.round(value / denominator * 100)}%</small></div>`).join('')}</div></div></article><article class="analysis-card analysis-health card"><div class="analysis-card-heading"><div><h2>Verification health</h2><p>Measured signals from model responses</p></div></div><div class="health-list">${health.map(([label, value, width, tone]) => `<div class="health-row"><div><span>${esc(label)}</span><b>${esc(value)}</b></div><i class="health-meter ${tone}"><em style="width:${width}%"></em></i></div>`).join('')}</div></article><article class="analysis-card analysis-recent card"><div class="analysis-card-heading"><div><h2>Recent analyses</h2><p>Open an audit record to inspect its claims, evidence, and model contributions.</p></div><span>${state.runs.length} recorded</span></div><div class="analysis-run-list">${recentRuns.length ? recentRuns.map((run) => `<button class="analysis-run" data-action="view-run" data-run-id="${esc(run.id)}"><span class="analysis-run-main"><b>${esc(run.task || 'Untitled analysis')}</b><small>${timeAgo(run.startedAt)} · ${run.modelCount} model${run.modelCount === 1 ? '' : 's'}</small></span><span class="decision-badge ${statusClass(run.decision)}">${esc(run.decision)}</span><strong class="confidence-display">~${displayedConfidence(run.confidence)}%</strong></button>`).join('') : '<div class="analysis-empty">Run an analysis to see session outcomes here.</div>'}</div></article></section>${footer()}`);
}

function settingsPage() {
  const limits = state.config?.limits || {};
  const direct = state.config?.directProviders || {};
  const providerState = (provider) => provider?.configured ? 'available' : 'not-verified';
  return pageShell(`${pageTitle('Settings', 'Server-owned settings are visible here without exposing secrets.')}<section class="settings-grid"><article class="settings card"><h2>OpenRouter</h2><div class="setting-row"><div><div class="setting-label">API key</div><div class="setting-help">Kept server-side only</div></div><span class="masked">••••••••••••••••</span></div><div class="setting-row"><div><div class="setting-label">Connection status</div><div class="setting-help">Unified provider gateway</div></div><span class="status ${state.config?.openRouterConfigured ? 'available' : 'demo-ready'}">${state.config?.openRouterConfigured ? 'Configured' : 'Demo fallback'}</span></div><div class="setting-row"><div><div class="setting-label">Available models</div><div class="setting-help">Refreshes safely from the server</div></div><button class="button-secondary small" data-action="refresh-models">Refresh</button></div></article><article class="settings card"><h2>Direct Provider Keys</h2><div class="setting-row"><div><div class="setting-label">Google Gemini</div><div class="setting-help">${esc(direct.gemini?.model || 'Model not set')}</div></div><span class="status ${providerState(direct.gemini)}">${direct.gemini?.configured ? 'Configured' : 'Key missing'}</span></div><div class="setting-row"><div><div class="setting-label">OpenAI GPT</div><div class="setting-help">${esc(direct.openai?.model || 'Model not set')}</div></div><span class="status ${providerState(direct.openai)}">${direct.openai?.configured ? 'Configured' : 'Key missing'}</span></div><div class="setting-row"><div><div class="setting-label">OpenRouter paid models</div><div class="setting-help">Gemini, GPT, and Claude via OpenRouter credit</div></div><span class="status ${state.config?.paidModelsEnabled ? 'available' : 'not-verified'}">${state.config?.paidModelsEnabled ? 'Enabled' : 'Off'}</span></div></article><article class="settings card"><h2>Verification</h2><div class="setting-row"><div><div class="setting-label">Maximum correction attempts</div><div class="setting-help">Prevents unbounded correction loops</div></div><b>${limits.maxRetries ?? '—'}</b></div><div class="setting-row"><div><div class="setting-label">Maximum reasoning rounds</div><div class="setting-help">Limits cost and latency</div></div><b>${limits.maxRounds ?? '—'}</b></div><div class="setting-row"><div><div class="setting-label">Sandbox execution</div><div class="setting-help">Unsafe code is never run without a hardened executor</div></div><span class="status ${state.config?.sandboxAvailable ? 'available' : 'not-verified'}">${state.config?.sandboxAvailable ? 'Available' : 'Not configured'}</span></div></article><article class="settings card"><h2>Model Configuration</h2><div class="setting-row"><div><div class="setting-label">Smart pool size</div><div class="setting-help">Routing favors capability and diversity</div></div><b>${limits.modelCount ?? '—'}</b></div><div class="setting-row"><div><div class="setting-label">Maximum backup calls</div><div class="setting-help">Adds providers only after failures</div></div><b>${limits.maxModelCalls ?? '—'}</b></div><div class="setting-row"><div><div class="setting-label">Full pool</div><div class="setting-help">Attempts all enabled providers, recording failures</div></div><b>${state.models.filter((model) => model.status !== 'disabled').length}</b></div></article><article class="settings card"><h2>Safety & privacy</h2><div class="setting-row"><div><div class="setting-label">Prompt injection defense</div><div class="setting-help">Documents are passed as untrusted data</div></div><span class="status available">Active</span></div><div class="setting-row"><div><div class="setting-label">Audit storage</div><div class="setting-help">Runs preserve source responses and decisions for this session</div></div><span class="status available">Active</span></div></article></section>${footer()}`);
}

function providerSettingsPage() {
  const direct = state.config?.directProviders || {};
  const status = (configured) => configured ? 'available' : 'unavailable';
  const label = (configured) => configured ? 'Configured' : 'Not configured';
  return pageShell(`${pageTitle('Provider Settings', 'Add keys in this local app. Keys are saved server-side and are never returned to the browser.')}<section class="settings-grid"><article class="settings card provider-settings-card"><h2>API keys & models</h2><p class="panel-subtitle">Leave a key field blank to keep its existing value. Saving refreshes the available-model list.</p><div class="provider-status-row"><span>OpenRouter</span><span class="status ${status(state.config?.openRouterConfigured)}">${label(state.config?.openRouterConfigured)}</span></div><label class="settings-input"><span>OpenRouter API key</span><input id="openrouter-api-key" type="password" autocomplete="new-password" placeholder="Paste only to replace the stored key"></label><label class="settings-input"><span>Gemini API key</span><input id="gemini-api-key" type="password" autocomplete="new-password" placeholder="Paste only to replace the stored key"></label><label class="settings-input"><span>Gemini model</span><input id="gemini-model" value="${esc(direct.gemini?.model || 'gemini-3.8-flash')}" maxlength="160" spellcheck="false"></label><div class="provider-status-row"><span>Google Gemini</span><span class="status ${status(direct.gemini?.configured)}">${label(direct.gemini?.configured)}</span></div><label class="settings-input"><span>OpenAI API key</span><input id="openai-api-key" type="password" autocomplete="new-password" placeholder="Paste only to replace the stored key"></label><label class="settings-input"><span>OpenAI model</span><input id="openai-model" value="${esc(direct.openai?.model || 'gpt-4.1-mini')}" maxlength="160" spellcheck="false"></label><div class="provider-status-row"><span>OpenAI GPT</span><span class="status ${status(direct.openai?.configured)}">${label(direct.openai?.configured)}</span></div><label class="settings-check"><input id="allow-paid-models" type="checkbox" ${state.config?.paidModelsEnabled ? 'checked' : ''}> Allow paid OpenRouter models</label><div class="settings-actions"><button class="button-primary" data-action="save-provider-settings">Save provider settings</button><button class="button-secondary" data-action="refresh-models">Refresh models</button></div></article><article class="settings card"><h2>Availability legend</h2><div class="setting-row"><div><div class="setting-label"><i class="availability-dot green"></i> Green dot</div><div class="setting-help">The model can be selected and called by the current server.</div></div></div><div class="setting-row"><div><div class="setting-label"><i class="availability-dot red"></i> Red dot</div><div class="setting-help">A key, credit, access, or provider capacity is unavailable. It cannot be selected.</div></div></div><div class="setting-row"><div><div class="setting-label">Automatic recovery</div><div class="setting-help">Retryable provider errors are retried, then healthy backup models are used when possible.</div></div></div></article><article class="settings card"><h2>Verification controls</h2><div class="setting-row"><div><div class="setting-label">Smart pool</div><div class="setting-help">Task-aware, diverse model routing</div></div><b>${state.config?.limits?.modelCount ?? '—'}</b></div><div class="setting-row"><div><div class="setting-label">Maximum backup calls</div><div class="setting-help">Used only when provider calls do not succeed</div></div><b>${state.config?.limits?.maxModelCalls ?? '—'}</b></div><div class="setting-row"><div><div class="setting-label">Concurrent provider calls</div><div class="setting-help">A small queue reduces rate-limit failures.</div></div><b>${state.config?.limits?.modelConcurrency ?? '—'}</b></div><div class="setting-row"><div><div class="setting-label">Minimum successful models</div><div class="setting-help">The recovery target when healthy models are available</div></div><b>${state.config?.limits?.minSuccessfulModels ?? '—'}</b></div></article></section>${footer()}`);
}

function pipeline() {
  const sequence = [
    ['task-analysis', 'Task Analysis', 'document'],
    ['planning', 'Planning', 'brain'],
    ['generation', 'Multi-Model<br>Generation', 'network'],
    ['evidence', 'Evidence<br>Retrieval', 'searchdoc'],
    ['verification', 'Verification', 'shield'],
    ['contradiction', 'Contradiction<br>Check', 'swap'],
    ['correction', 'Self-Correction', 'refresh'],
    ['red-team', 'Red-Team<br>Review', 'shield'],
    ['finalization', 'Final Answer', 'spark']
  ];
  const stageForEvent = { 'model-routing': 'generation', 'model-fallback': 'generation', 'claim-extraction': 'generation', sandbox: 'verification', 'gemini-review': 'finalization' };
  const completed = new Set(state.events.map((event) => stageForEvent[event.stage] || event.stage));
  const lastEvent = state.events[state.events.length - 1]?.stage;
  const last = stageForEvent[lastEvent] || lastEvent;
  const activeIndex = Math.min(sequence.length, Math.max(0, sequence.findIndex(([stage]) => stage === last) + 1));
  return `<section class="pipeline aurora-pipeline card" aria-label="Analysis progress">${sequence.map(([stage, label, symbol], index) => {
    const done = completed.has(stage) || index < activeIndex;
    const active = index === activeIndex && activeIndex < sequence.length;
    const status = done ? 'Completed' : active ? 'In Progress' : 'Pending';
    return `<div class="pipeline-step ${done ? 'done' : active ? 'live' : ''}"><div class="pipeline-node"><span class="pipeline-node-icon">${done ? icon('shield') : icon(symbol)}</span><span class="pipeline-sparkle" aria-hidden="true">${icon('spark')}</span></div><div class="pipeline-label">${label}</div><div class="pipeline-detail pipeline-state ${done ? 'completed' : active ? 'progress' : 'pending'}"><i aria-hidden="true">${done ? '✓' : active ? '•' : '◷'}</i>${status}</div></div>`;
  }).join('')}</section>`;
}

function executionPage() {
  const run = state.activeRun || { id: 'RUN-PENDING', task: { text: state.draft.task }, models: [], responses: [] };
  const modelStates = run.models?.map((model) => {
    const event = [...state.events].reverse().find((item) => item.modelId === model.modelId);
    return { ...model, state: event?.status || 'waiting' };
  }) || [];
  return pageShell(`${pageTitle('Execution Workspace', 'Observe independent model generation and verification as they happen.')}<section class="execution-hero card"><div><div class="run-id">${esc(run.id)}</div><h2>${esc(run.task?.text || 'Preparing analysis…')}</h2></div><span class="decision-badge">VERIFYING</span></section>${pipeline()}<section class="execution-grid section"><article class="live-card card"><div class="section-heading"><div><h2>Live Agent Activity</h2><p>Progress events are appended to the audit trail.</p></div></div><div class="event-list">${state.events.length ? state.events.slice(-12).reverse().map((event) => `<div class="event"><span class="event-mark">${event.stage === 'failed' ? '!' : '✓'}</span><div><div class="event-text">${esc(event.message)}</div><div class="event-stage">${esc(event.stage)}</div></div><time>${new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>`).join('') : skeletonEvents()}</div></article><aside class="model-execution card"><div class="section-heading"><div><h2>Model Network</h2><p>Initial responses are isolated.</p></div></div><div class="model-execution-list">${modelStates.length ? modelStates.map((model) => `<div class="model-execution-row"><span class="model-glyph">${esc(model.provider.slice(0,2).toUpperCase())}</span><span class="model-name">${esc(model.provider)}</span><span class="status ${statusClass(model.state)}">${esc(model.state)}</span></div>`).join('') : skeletonCards(5)}</div></aside></section>${footer()}`);
}

function runResultPage() {
  const run = state.activeRun;
  if (!run || (run.status !== 'complete' && run.status !== 'failed')) return executionPage();
  const decisionClass = statusClass(run.decision?.status);
  const perspectives = run.responses.map((response, responseIndex) => ({ response, responseIndex })).filter(({ response }) => response.status === 'success');
  const answerNotice = run.finalAnswer?.answerKind === 'provisional' ? `<div class="banner warning"><span>${icon('shield')}</span><div><strong>Provisional resultant answer</strong>This synthesis is shown from ${esc(run.finalAnswer.perspectiveProvider || 'a successful model')} for usefulness. The decision remains ${esc(run.decision?.title || 'limited')} until evidence verifies it.</div></div>` : '';
  const perspectiveCards = perspectives.length ? perspectives.map(({ response, responseIndex }) => `<article class="response-card"><h3>${esc(response.provider)}</h3><p>${esc(response.answer || 'No answer')}</p><div class="response-meta"><span class="status available">included</span><span>${response.latencyMs}ms</span></div><button class="button-tertiary small" data-action="show-response" data-response="${responseIndex}">View response</button></article>`).join('') : '<div class="empty"><strong>No successful perspectives</strong>The final decision remains visible without displaying failed provider output.</div>';
  return pageShell(`${run.metadata?.demoFallback ? demoBanner() : ''}<section class="result-header card"><div><span class="decision-badge ${decisionClass}">${esc(run.decision?.title || 'COMPLETE')}</span><h1>Resultant Answer</h1>${answerNotice}<div class="result-answer">${esc(run.finalAnswer?.conclusion || '')}</div></div><div class="result-actions"><button class="button-secondary small" data-action="export" data-format="markdown">Export report</button></div></section><section class="result-grid"><div class="stack"><article class="panel card"><div class="section-heading"><div><h2>Claim Matrix</h2><p>Agreement is visible, but evidence and independent checks determine acceptance.</p></div></div>${claimTable(run)}</article><article class="panel card"><div class="section-heading"><div><h2>Evidence</h2><p>Source provenance and relationship to claims.</p></div><button class="button-tertiary small" data-action="show-evidence">View graph</button></div>${evidenceList(run)}</article><article class="panel card"><div class="section-heading"><div><h2>Model Perspectives</h2><p>Successful independent perspectives only; provider failures remain in the private audit export.</p></div></div><div class="model-response-grid">${perspectiveCards}</div></article></div><div class="stack"><article class="certificate card"><h2>Verification Certificate</h2><p class="panel-subtitle">Evidence-first decision record</p><div class="cert-seal">${run.decision?.status === 'verified' ? '✓' : '!'}</div><div class="cert-metrics"><div class="cert-metric">Claims checked<strong>${run.claims.length}</strong></div><div class="cert-metric">Evidence sources<strong>${run.evidence.length}</strong></div><div class="cert-metric">Independent checks<strong>${run.checks.length}</strong></div><div class="cert-metric">Contradictions<strong>${run.contradictions.length}</strong></div><div class="cert-metric">Corrections<strong>${run.corrections.length}</strong></div><div class="cert-metric">Confidence<strong class="confidence-display">~${displayedConfidence(run.confidence?.score)}%</strong></div></div></article><article class="panel card"><h2>Verification Checks</h2><p class="panel-subtitle">Each result has a visible state.</p><div class="check-grid">${run.checks.map((check) => `<div class="check"><div class="check-title"><span>${esc(check.type)}</span><span class="status ${statusClass(check.status)}">${esc(check.status)}</span></div><div class="check-detail">${esc(check.detail)}</div></div>`).join('')}</div></article><article class="panel card"><h2>Limitations & decision</h2><p class="panel-subtitle">${esc(run.decision?.reason || '')}</p><ul class="limit-list">${(run.finalAnswer?.limitations || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></article><article class="panel card"><h2>Correction Timeline</h2><p class="panel-subtitle">Corrected output is always re-verified.</p>${correctionTimeline(run)}</article><article class="panel card"><h2>Was this useful?</h2><p class="panel-subtitle">Feedback helps improve the evaluation dataset.</p><div><button class="button-secondary small" data-action="feedback" data-rating="up">Useful</button><button class="button-secondary small" data-action="feedback" data-rating="down">Needs review</button></div></article></div></section>${footer()}`);
}

function claimTable(run) { return `<div class="claim-table-wrap"><table class="claim-table"><thead><tr><th>Claim</th><th>Model agreement</th><th>Evidence</th><th>Verification</th><th>Confidence</th></tr></thead><tbody>${run.claims.map((claim) => `<tr><td class="claim-text"><strong>${esc(claim.id)}</strong> ${esc(claim.text)}</td><td>${claim.agreement?.supporters || 0}/${claim.agreement?.total || 0}</td><td>${claim.evidenceIds?.length || 0} item(s)</td><td><span class="tag ${statusClass(claim.status)}">${esc(claim.status)}</span></td><td class="confidence confidence-display">~${displayedConfidence(claim.confidence)}%</td></tr>`).join('') || '<tr><td colspan="5">No extractable claims.</td></tr>'}</tbody></table></div>`; }
function evidenceList(run) { return `<div class="evidence-list">${run.evidence.length ? run.evidence.map((item) => `<article class="evidence"><div class="evidence-title">${esc(item.title)} <span class="tag ${item.relation === 'supports' ? 'verified' : 'rejected'}">${esc(item.relation)}</span></div><div class="evidence-meta">${esc(item.domain)} · ${esc(item.type)} · relevance ${Math.round(item.relevance * 100)}%${item.freshness ? ` · ${esc(item.freshness.label)}` : ''}</div><p class="evidence-excerpt">${esc(item.excerpt)}</p></article>`).join('') : '<div class="empty"><strong>No evidence found</strong>Additional verification may be required.</div>'}</div>`; }
function correctionTimeline(run) { const items = [{ title: 'Initial answer', text: 'Independent perspectives generated.' }, ...run.corrections.map((correction) => ({ title: `Correction ${correction.attempt}`, text: correction.action })), { title: 'Final verification', text: run.decision?.title || 'Complete' }]; return `<div class="timeline">${items.map((item) => `<div class="timeline-item"><strong>${esc(item.title)}</strong>${esc(item.text)}</div>`).join('')}</div>`; }
function skeletonCards(count) { return Array.from({ length: count }, () => '<div class="model-card"><div class="skeleton" style="width:72%"></div><div class="skeleton" style="width:46%;margin-top:11px"></div></div>').join(''); }
function skeletonEvents() { return Array.from({ length: 6 }, () => '<div class="event"><span class="event-mark">•</span><div><div class="skeleton" style="width:64%"></div><div class="skeleton" style="width:28%;margin-top:6px"></div></div><span></span></div>').join(''); }

function modal() {
  if (!state.modal) return '';
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-content><header class="modal-head"><h2 id="modal-title">${esc(state.modal.title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button></header><div class="modal-body">${state.modal.body}</div></section></div>`;
}

function evidenceStrength(run) {
  const configuredScore = Number(run.confidence?.evidenceCoverage);
  const sources = (run.evidence || []).filter((item) => item.relation === 'supports');
  const score = Number.isFinite(configuredScore) ? configuredScore : sources.length ? Math.round(Math.max(...sources.map((item) => Number(item.relevance || 0))) * 100) : 0;
  return { score, label: score >= 85 ? 'Strong' : score >= 60 ? 'Moderate' : score ? 'Weak' : 'Insufficient' };
}

function agentLedgerCard(run) {
  const agents = run.agentLedger || [];
  const rows = agents.length ? agents.map((agent) => `<li><div><b>${esc(agent.role.replaceAll('-', ' '))}</b> <span class="tag ${statusClass(agent.status)}">${esc(agent.status)}</span></div><p>${esc(agent.detail || agent.responsibility || 'No detail recorded.')}</p></li>`).join('') : '<li>No agent ledger is available for this historical run.</li>';
  return `<article class="insight-card agent-ledger-card"><div class="insight-title"><h3>Specialist agent ledger</h3><span>${agents.length} roles</span></div><p>Each role has a separate responsibility and recorded outcome.</p><ul class="contribution-list">${rows}</ul></article>`;
}

function runInsights(run) {
  if (!run || !['complete', 'failed'].includes(run.status)) return '';
  const strength = evidenceStrength(run);
  const disagreement = run.disagreement || { agreement: 0, disagreement: 0, outlierModels: [] };
  const respondingModels = Number(run.participation?.respondingModels ?? run.confidence?.respondingModels ?? run.responses?.filter((response) => response.status === 'success' && String(response.answer || '').trim()).length ?? 0);
  const findings = run.redTeam?.findings || [];
  const attacks = run.adversarialAttacks || [];
  const reviews = run.humanReviews || (run.reviewCheckpoint ? [run.reviewCheckpoint] : []);
  const latestAttack = attacks[attacks.length - 1];
  const latestReview = reviews[reviews.length - 1];
  const actionBusy = Boolean(state.pendingAction);
  const disabled = actionBusy ? ' disabled aria-disabled="true"' : '';
  const attackLabel = state.pendingAction === 'attack-answer' ? 'Running challenge…' : 'Challenge answer';
  const replayLabel = state.pendingAction === 'replay-run' ? 'Starting replay…' : 'Replay analysis';
  const reviewLabel = latestReview ? titleCase(latestReview.action) : 'Not reviewed';
  const auditTime = (value) => value ? new Date(value).toLocaleString() : '';
  const list = (items, empty) => items?.length ? `<ul>${items.map((item) => `<li>${esc(typeof item === 'string' ? item : item.text || item.detail || '')}</li>`).join('')}</ul>` : `<p class="insight-empty">${esc(empty)}</p>`;
  const contributions = (run.contributions || []).map((item) => `<li><b>${esc(item.provider)}</b><span>${item.acceptedClaims?.length ? `Accepted: ${item.acceptedClaims.join(', ')}` : item.limitedClaims?.length ? `Limited: ${item.limitedClaims.join(', ')}` : 'No claim retained'}</span></li>`).join('') || '<li>No successful model contribution was recorded.</li>';
  const radarItems = (disagreement.items || []).map((item) => `<li><div><b>${esc(item.claimId)}</b><span>${item.supporters}/${item.total} models agree</span></div><strong>${item.agreement}%</strong><i class="tag ${statusClass(item.status)}">${esc(item.status)}</i></li>`).join('') || '<li><span>No comparable claims were returned.</span></li>';
  return `<section class="run-insights" aria-label="Verification details"><article class="insight-card"><div class="insight-title"><h3>Reliability signals</h3><span class="tag ${strength.score >= 60 ? 'verified' : 'unsupported'}">${esc(strength.label)}</span></div><div class="signal-row"><span>Evidence coverage</span><b>${strength.score}%</b></div><div class="signal-meter"><i style="width:${strength.score}%"></i></div><div class="signal-row"><span>Model agreement</span><b>${disagreement.agreement || 0}%</b></div><div class="signal-meter neutral"><i style="width:${disagreement.agreement || 0}%"></i></div><p>Based on ${respondingModels} model${respondingModels === 1 ? '' : 's'} that returned an answer. Unavailable, inactive, failed, and empty responses are not counted.</p></article><article class="insight-card disagreement-radar"><div class="insight-title"><h3>Model disagreement radar</h3><span>${disagreement.disagreement || 0}% disagreement</span></div><p>Each row shows the models backing one normalized claim. Agreement is a signal, never proof.</p><ul>${radarItems}</ul>${disagreement.outlierModels?.length ? `<p class="insight-note">Outlier perspectives: ${esc(disagreement.outlierModels.join(', '))}</p>` : ''}</article><article class="insight-card"><div class="insight-title"><h3>Assumptions & change conditions</h3><span>${(run.assumptions || []).length} assumptions</span></div><details><summary>Assumptions detected</summary>${list(run.assumptions, 'No explicit assumptions were captured.')}</details><details><summary>What could change the answer?</summary>${list(run.answerConditions, 'No additional change condition was identified.')}</details><details><summary>Counterexamples to test</summary>${list(run.counterexamples, 'No targeted counterexample was generated.')}</details></article><article class="insight-card"><div class="insight-title"><h3>Model contribution map</h3><span>${(run.contributions || []).length} models</span></div><ul class="contribution-list">${contributions}</ul></article><article class="insight-card action-center-card"><div class="action-center-head"><div><p class="action-eyebrow">Result actions</p><h3>Challenge, review, or rerun</h3><p>Each action is saved to this run. Human review is visible here but does not change the automated verification decision.</p></div><div class="action-summary"><span>Challenge</span><b>${attacks.length} completed</b><span>Human review</span><b>${esc(reviewLabel)}</b></div></div><div class="result-action-grid"><section class="result-action challenge-action"><div><b>Challenge answer</b><span>Test the result for unsupported claims and contradictions.</span></div><button class="button-secondary small" type="button" data-action="attack-answer"${disabled}>${attackLabel}</button></section><section class="result-action approve-action"><div><b>Approve review</b><span>Record that a person accepts this result for use.</span></div><button class="button-secondary small" type="button" data-action="human-review" data-review-action="approve"${disabled}>${state.pendingAction === 'human-review' ? 'Saving…' : 'Approve'}</button></section><section class="result-action evidence-action"><div><b>Request evidence</b><span>Flag the result for additional supporting evidence.</span></div><button class="button-secondary small" type="button" data-action="human-review" data-review-action="request-evidence"${disabled}>${state.pendingAction === 'human-review' ? 'Saving…' : 'Request evidence'}</button></section><section class="result-action reject-action"><div><b>Reject review</b><span>Record that a person does not accept this result.</span></div><button class="button-secondary small" type="button" data-action="human-review" data-review-action="reject"${disabled}>${state.pendingAction === 'human-review' ? 'Saving…' : 'Reject'}</button></section><section class="result-action replay-action"><div><b>Replay analysis</b><span>Run the same task again using the currently available providers.</span></div><button class="button-tertiary small" type="button" data-action="replay-run"${disabled}>${replayLabel}</button></section></div><div class="action-audit" aria-live="polite"><div><b>Latest challenge</b><span>${latestAttack ? `${latestAttack.findings?.length || 0} finding${latestAttack.findings?.length === 1 ? '' : 's'} · ${esc(auditTime(latestAttack.at))}` : 'No manual challenge has been run.'}</span></div><div><b>Latest human review</b><span>${latestReview ? `${esc(titleCase(latestReview.action))} · ${esc(auditTime(latestReview.at))}` : 'No human review has been recorded.'}</span></div></div>${latestAttack ? list(latestAttack.findings, 'The latest challenge found no additional issue.') : ''}</article></section>`;
}

function evaluationArena() {
  const metrics = state.analytics || {};
  const completed = (metrics.tasksVerified || 0) + (metrics.tasksLimited || 0) + (metrics.tasksNeedsEvidence || 0);
  const measures = [
    ['Verified runs', metrics.tasksVerified || 0], ['Limited runs', metrics.tasksLimited || 0], ['Needs evidence', metrics.tasksNeedsEvidence || 0], ['Claims checked', metrics.claimsChecked || 0], ['Contradictions found', metrics.contradictionsDetected || 0], ['Corrections made', metrics.correctionsPerformed || 0]
  ];
  return `<section class="evaluation-arena card"><div><p class="eyebrow">Evaluation arena</p><h2>Measured verification outcomes</h2><p>These totals are calculated from completed audit runs in this session. Expected scenario behavior is kept separate from observed results.</p></div><div class="arena-metrics">${measures.map(([label, value]) => `<div><b>${value}</b><span>${esc(label)}</span></div>`).join('')}</div><div class="arena-note"><b>${completed ? `${completed} completed run${completed === 1 ? '' : 's'}` : 'No completed runs yet'}</b><span>${state.scenarios.length} reproducible scenarios are ready to run. Results are never pre-filled as benchmark scores.</span></div></section>`;
}

function enhanceRenderedPage() {
  if (state.page === 'execution') {
    const hero = $('.execution-hero');
    if (hero && !hero.querySelector('[data-action="toggle-sound"]')) {
      const control = document.createElement('button');
      control.className = 'button-secondary small execution-sound'; control.dataset.action = 'toggle-sound';
      control.setAttribute('aria-pressed', String(state.soundEnabled)); control.textContent = state.soundEnabled ? 'Sound on' : 'Sound off';
      hero.append(control);
    }
  }
  const host = $('.studio-result-card') || $('.result-header');
  if (host && state.activeRun && !document.querySelector('.run-insights')) host.insertAdjacentHTML('afterend', runInsights(state.activeRun));
  const insights = $('.run-insights');
  if (insights && state.activeRun && !insights.querySelector('.agent-ledger-card')) insights.insertAdjacentHTML('beforeend', agentLedgerCard(state.activeRun));
  if (state.page === 'analytics') {
    const container = $('#main-content .container');
    if (container && !container.querySelector('.evaluation-arena')) container.insertAdjacentHTML('beforeend', evaluationArena());
  }
  const nav = $('.studio-nav');
  if (nav && !nav.querySelector('[data-page="analytics"]')) nav.insertAdjacentHTML('beforeend', '<button data-action="navigate" data-page="analytics">◫ <span>Analysis</span></button>');
}

function render() {
  const pages = { home: homePage, models: modelLabPage, analytics: analyticsPage, settings: providerSettingsPage, execution: executionPage, result: runResultPage };
  app.innerHTML = (pages[state.page] || homePage)() + modal();
  enhanceRenderedPage();
}

async function refreshData() {
  const [config, scenarios, models, runs, analytics] = await Promise.all([api('/api/config'), api('/api/scenarios'), api('/api/models').catch(() => ({ models: [] })), api('/api/runs'), api('/api/analytics')]);
  state.config = config; state.scenarios = scenarios.scenarios; state.models = models.models; state.runs = runs.runs; state.analytics = analytics;
}

async function refreshModels() { const result = await api('/api/models?refresh=true'); state.models = result.models; render(); toast('Model registry refreshed.'); }

async function saveProviderSettings() {
  const geminiModel = $('#gemini-model')?.value.trim();
  const openAiModel = $('#openai-model')?.value.trim();
  if (!geminiModel || !openAiModel) { toast('Enter a Gemini and OpenAI model name.'); return; }
  const payload = { geminiModel, openAiModel, openRouterAllowPaidModels: Boolean($('#allow-paid-models')?.checked) };
  const keyFields = [['#openrouter-api-key', 'openRouterApiKey'], ['#gemini-api-key', 'geminiApiKey'], ['#openai-api-key', 'openAiApiKey']];
  for (const [selector, key] of keyFields) {
    const value = $(selector)?.value.trim();
    if (value) payload[key] = value;
  }
  const result = await api('/api/settings/providers', { method: 'POST', body: JSON.stringify(payload) });
  state.config = result.config;
  const models = await api('/api/models?refresh=true');
  state.models = models.models;
  render();
  toast('Provider settings saved. Keys remain hidden.');
}

function persistDraft() { const input = $('#task-input'); const pool = $('#pool-mode'); const verification = $('#verification-mode'); if (input) state.draft.task = input.value; if (pool) state.draft.poolMode = pool.value; if (verification) state.draft.verificationMode = verification.value; }

function watchRun(started) {
  const stream = new EventSource(started.eventsUrl);
  stream.addEventListener('progress', (message) => {
    const event = JSON.parse(message.data); state.events.push(event); notifyProgress(event);
    if (event.models) state.activeRun.models = state.models.filter((model) => event.models.includes(model.modelId));
    render();
  });
  stream.addEventListener('complete', async () => {
    stream.close(); state.activeRun = await api(`/api/runs/${started.runId}`); state.runs = (await api('/api/runs')).runs; state.analytics = await api('/api/analytics');
    state.draft = { ...state.draft, task: '', files: [] }; state.page = 'home'; render(); toast('Verification completed. The resultant answer is ready.');
  });
  stream.onerror = async () => {
    stream.close(); const current = await api(`/api/runs/${started.runId}`).catch(() => null);
    if (current?.status === 'complete' || current?.status === 'failed') { state.activeRun = current; state.draft = { ...state.draft, task: '', files: [] }; state.page = 'home'; render(); }
    else toast('Live update connection paused; the run remains auditable.');
  };
}

async function startRun(scenarioId = '') {
  persistDraft();
  const scenario = state.scenarios.find((item) => item.id === scenarioId);
  if (scenario) { state.draft.task = scenario.task; state.draft.mode = scenario.tab; }
  if (!state.draft.task.trim() && !state.draft.files.length) { toast('Enter a task or attach a file or image before running an analysis.'); return; }
  unlockProgressSound();
  state.page = 'execution'; state.events = []; state.soundedStages = new Set(); state.activeRun = { id: 'RUN-PENDING', task: { text: state.draft.task }, models: [] }; render();
  try {
    const started = await api('/api/runs', { method: 'POST', body: JSON.stringify({ task: state.draft.task, mode: state.draft.mode, poolMode: state.draft.poolMode, verificationMode: state.draft.verificationMode, customModels: state.draft.customModels, documents: state.draft.files, scenario: scenarioId }) });
    state.activeRun.id = started.runId; render(); toast('Analysis started.');
    watchRun(started);
  } catch (error) { state.page = 'home'; render(); toast(error.message); }
}

async function viewRun(runId) { state.activeRun = await api(`/api/runs/${runId}`); state.page = state.activeRun.status === 'complete' || state.activeRun.status === 'failed' ? 'home' : 'execution'; if (state.page === 'home') state.draft = { ...state.draft, task: '', files: [] }; state.events = []; render(); }

function responseModal(index) { const response = state.activeRun?.responses?.[Number(index)]; if (!response) return; state.modal = { title: `${response.provider} perspective`, body: `<p><span class="status ${statusClass(response.status)}">${esc(response.status)}</span> · ${response.latencyMs}ms · ${esc(response.source)}</p><div class="model-answer">${esc(response.answer || response.errors?.[0] || 'No response')}</div><h3>Claims</h3><ul class="limit-list">${response.claims.map((claim) => `<li>${esc(claim.text)}</li>`).join('') || '<li>No structured claims extracted.</li>'}</ul><h3>Uncertainty</h3><ul class="limit-list">${response.uncertainties.map((item) => `<li>${esc(item)}</li>`).join('') || '<li>None stated.</li>'}</ul>` }; render(); }

function evidenceGraphModal() { const run = state.activeRun; const claims = run.claims.slice(0, 4); const evidence = run.evidence.slice(0, 4); const links = claims.map((_, index) => `<line x1="170" y1="${38 + index * 48}" x2="365" y2="${38 + (index % Math.max(evidence.length,1)) * 48}"/>`).join(''); state.modal = { title: 'Claim & Evidence Graph', body: `<div class="graph"><svg viewBox="0 0 540 240" role="img" aria-label="Claims connected to evidence sources">${links}${claims.map((claim,index) => `<rect class="claim-node" x="30" y="${20+index*48}" width="145" height="31" rx="8"/><text x="40" y="${40+index*48}">${esc((claim.text || '').slice(0,20))}</text>`).join('')}${evidence.map((item,index) => `<rect class="evidence-node" x="365" y="${20+index*48}" width="145" height="31" rx="8"/><text x="375" y="${40+index*48}">${esc((item.title || '').slice(0,19))}</text>`).join('')}</svg></div><p class="panel-subtitle">Blue nodes are claims. Green nodes are evidence items. Lines show the claim-to-evidence links retained in the audit record.</p>` }; render(); }

function modelSelectionModal() { state.modal = { title: 'Select available model perspectives', body: `<p class="panel-subtitle">Only green, currently available providers can be selected. Choosing models creates a fixed pool: only those models are called and checked, with no automatic backup provider added.</p><div class="model-execution-list">${state.models.map((model) => `<label class="model-execution-row"><input type="checkbox" class="custom-model" value="${esc(model.modelId)}" ${state.draft.customModels.includes(model.modelId) ? 'checked' : ''} ${modelIsAvailable(model) ? '' : 'disabled'}>${modelLogo(model, true)}<span class="model-name">${esc(model.provider)}</span><span class="status ${statusClass(model.status)}">${esc(model.status)}</span></label>`).join('')}</div><div style="margin-top:15px"><button class="button-primary" data-action="save-models">Use selected models</button></div>` }; render(); }

function architectureModal() { state.modal = { title: 'Evidence-first architecture', body: `<div class="timeline"><div class="timeline-item"><strong>Task analyzer & planner</strong>Classifies the task and defines required evidence and checks.</div><div class="timeline-item"><strong>Provider-agnostic model gateway</strong>Queries independent OpenRouter model perspectives in parallel when configured.</div><div class="timeline-item"><strong>Claim and evidence engine</strong>Normalizes responses, links atomic claims to provenance, and exposes conflicts.</div><div class="timeline-item"><strong>Independent verifier & safety gate</strong>Uses deterministic checks where possible and never turns consensus into proof.</div><div class="timeline-item"><strong>Decision, correction & audit</strong>Routes failures, re-verifies corrections, and exports an immutable execution record.</div></div>` }; render(); }

function timeAgo(value) { const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return 'just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`; return `${Math.floor(seconds / 3600)} hr ago`; }

app.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const action = target.dataset.action;
  if (action === 'navigate') { persistDraft(); state.page = target.dataset.page; state.menuOpen = false; render(); if (state.page === 'analytics') { state.analytics = await api('/api/analytics'); render(); } return; }
  if (action === 'reload') { window.location.reload(); return; }
  if (action === 'new-conversation') { state.draft = { task: '', mode: 'Ask', poolMode: 'smart', verificationMode: 'balanced', files: [], customModels: [] }; state.activeRun = null; state.page = 'home'; render(); $('#task-input')?.focus(); return; }
  if (action === 'view-activity') { toast(state.runs.length ? `${state.runs.length} analysis run(s) are available in Recent.` : 'No analysis activity yet.'); return; }
  if (action === 'toggle-menu') { state.menuOpen = !state.menuOpen; render(); return; }
  if (action === 'mode') { persistDraft(); state.draft.mode = target.dataset.mode; render(); return; }
  if (action === 'code-mode') {
    persistDraft(); state.draft.mode = 'Code'; render(); $('#task-input')?.focus();
    toast(state.draft.poolMode === 'smart' ? 'Code mode enabled. NVIDIA will generate first; other Smart models verify it.' : 'Code mode enabled. Your selected model pool remains unchanged.');
    return;
  }
  if (action === 'toggle-model') {
    const model = state.models.find((item) => item.modelId === target.dataset.modelId);
    if (!modelIsAvailable(model)) { toast('That model is not currently available.'); return; }
    state.draft.customModels = state.draft.customModels.includes(model.modelId) ? state.draft.customModels.filter((id) => id !== model.modelId) : [...state.draft.customModels, model.modelId];
    state.draft.poolMode = 'custom'; render(); return;
  }
  if (action === 'open-model-response') {
    const responseIndex = state.activeRun?.responses?.findIndex((response) => response.modelId === target.dataset.modelId && response.provider === target.dataset.provider);
    if (Number.isInteger(responseIndex) && responseIndex >= 0 && state.activeRun.responses[responseIndex].status === 'success') { responseModal(responseIndex); return; }
    const failedResponse = responseIndex >= 0 ? state.activeRun.responses[responseIndex] : null;
    toast(failedResponse ? `This model did not return an answer: ${failedResponse.errors?.[0] || 'request failed'}` : 'This model was not selected for the completed run.');
    return;
  }
  if (action === 'scroll-workspace') { $('#workspace')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (action === 'show-architecture') { architectureModal(); return; }
  if (action === 'show-result') { state.page = 'result'; render(); return; }
  if (action === 'run') { startRun(); return; }
  if (action === 'scenario') { startRun(target.dataset.scenario); return; }
  if (action === 'refresh-models') { try { await refreshModels(); } catch (error) { toast(error.message); } return; }
  if (action === 'save-provider-settings') { try { await saveProviderSettings(); } catch (error) { toast(error.message); } return; }
  if (action === 'lab-filter') { state.labFilter = target.dataset.filter; render(); return; }
  if (action === 'view-run') { try { await viewRun(target.dataset.runId); } catch (error) { toast(error.message); } return; }
  if (action === 'show-response') { responseModal(target.dataset.response); return; }
  if (action === 'show-evidence') { evidenceGraphModal(); return; }
  if (action === 'close-modal') { if (event.target.matches('[data-modal-content]')) return; state.modal = null; render(); return; }
  if (action === 'select-models') { modelSelectionModal(); return; }
  if (action === 'save-models') { state.draft.customModels = [...document.querySelectorAll('.custom-model:checked')].map((input) => input.value); state.draft.poolMode = 'custom'; state.modal = null; render(); toast(`${state.draft.customModels.length} model(s) selected.`); return; }
  if (action === 'remove-file') { state.draft.files.splice(Number(target.dataset.index), 1); render(); return; }
  if (action === 'export') { if (state.activeRun?.id) window.location.assign(`/api/runs/${encodeURIComponent(state.activeRun.id)}/export?format=${target.dataset.format}`); return; }
  if (action === 'feedback') { try { await api('/api/feedback', { method: 'POST', body: JSON.stringify({ runId: state.activeRun?.id, rating: target.dataset.rating }) }); toast('Feedback recorded.'); } catch (error) { toast(error.message); } return; }
  if (action === 'toggle-sound') { state.soundEnabled = !state.soundEnabled; if (state.soundEnabled) { unlockProgressSound(); playProgressSound('task-analysis'); } render(); return; }
  if (action === 'attack-answer') {
    if (state.pendingAction) return;
    let runId;
    try {
      runId = completedRunId(); state.pendingAction = action; render();
      const result = await api(`/api/runs/${encodeURIComponent(runId)}/attack`, { method: 'POST', body: '{}' });
      await refreshRunState(runId, result.run);
      toast(result.attack.findings.length ? `Challenge recorded with ${result.attack.findings.length} finding(s).` : 'Challenge complete: no additional issue found.');
    } catch (error) { toast(error.message); }
    finally { state.pendingAction = null; render(); }
    return;
  }
  if (action === 'replay-run') {
    if (state.pendingAction) return;
    let sourceRun;
    try {
      const runId = completedRunId(); sourceRun = state.activeRun; state.pendingAction = action; render(); unlockProgressSound();
      const replay = await api(`/api/runs/${encodeURIComponent(runId)}/replay`, { method: 'POST', body: '{}' });
      state.pendingAction = null;
      state.activeRun = { id: replay.runId, status: 'running', task: sourceRun.task, models: [], replayOf: replay.replayOf };
      state.events = []; state.soundedStages = new Set(); state.page = 'execution'; render(); watchRun(replay);
      toast('Replay started with the current provider availability.');
    } catch (error) {
      state.pendingAction = null; render(); toast(error.message);
    }
    return;
  }
  if (action === 'human-review') {
    if (state.pendingAction) return;
    let runId;
    try {
      runId = completedRunId(); state.pendingAction = action; render();
      const result = await api(`/api/runs/${encodeURIComponent(runId)}/review`, { method: 'POST', body: JSON.stringify({ action: target.dataset.reviewAction }) });
      await refreshRunState(runId, result.run);
      toast(`Human review recorded: ${titleCase(result.review.action)}.`);
    } catch (error) { toast(error.message); }
    finally { state.pendingAction = null; render(); }
    return;
  }
});

app.addEventListener('keydown', (event) => {
  if (event.target.id !== 'task-input' || event.key !== 'Enter' || event.shiftKey || event.isComposing || event.repeat) return;
  event.preventDefault();
  startRun();
});

app.addEventListener('change', async (event) => {
  if (event.target.id === 'pool-mode') { state.draft.poolMode = event.target.value; return; }
  if (event.target.id === 'verification-mode') { state.draft.verificationMode = event.target.value; return; }
  if (event.target.id === 'task-mode') { state.draft.mode = event.target.value; persistDraft(); render(); return; }
  if (event.target.id !== 'file-input') return;
  const files = [...event.target.files];
  try {
    const allowed = new Set(['text/plain', 'text/markdown', 'application/json', 'text/csv']);
    const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (state.draft.files.length + files.length > 5) throw new Error('Attach a maximum of five files or images.');
    for (const file of files) {
      const image = imageTypes.has(file.type);
      const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const docx = file.type === docxType || /\.docx$/i.test(file.name);
      if (!image && !pdf && !docx && !allowed.has(file.type) && !/\.(txt|md|markdown|json|csv)$/i.test(file.name)) throw new Error(`${file.name}: choose a PNG, JPEG, WebP, GIF, PDF, DOCX, text, Markdown, JSON, or CSV file.`);
      if (file.size > (state.config?.limits?.maxFileBytes || 1048576)) throw new Error(`${file.name}: file is too large.`);
      if (image) {
        const imageData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error(`${file.name}: the image could not be read.`)); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
        state.draft.files.push({ name: file.name, type: file.type, kind: 'image', imageData });
      } else if (pdf || docx) {
        const fileData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error(`${file.name}: the document could not be read.`)); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
        state.draft.files.push({ name: file.name, type: pdf ? 'application/pdf' : docxType, kind: 'document', fileData });
      } else state.draft.files.push({ name: file.name, type: file.type || 'text/plain', kind: 'text', content: await file.text() });
    }
    render(); toast(`${files.length} file(s) attached. Images are read by vision models; PDF/DOCX text is extracted locally before analysis.`);
  } catch (error) { toast(error.message); event.target.value = ''; }
});

document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement && event.target.matches('.model-logo img')) event.target.hidden = true;
}, true);

async function boot() {
  try { await refreshData(); render(); }
  catch (error) { app.innerHTML = pageShell(`<div class="empty card"><strong>Connection unavailable</strong>${esc(error.message)}<br><button class="button-primary" data-action="reload">Retry</button></div>`); }
}

boot();
