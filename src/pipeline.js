'use strict';

const { config } = require('./config');
const { clamp, id, now, sleep, stripControlCharacters } = require('./utils');
const { runIsolatedJavaScript } = require('./sandbox');

const KNOWN_EVIDENCE = [
  {
    id: 'E-REDIS-001', title: 'Redis documentation: data types and use cases', domain: 'redis.io', type: 'curated-reference',
    excerpt: 'Redis is an in-memory data structure store used as a database, cache, streaming engine, and message broker.',
    supports: ['redis is not a relational sql database', 'redis is an in-memory data structure store'], contradicts: ['redis is a relational sql database'], reliability: 0.94
  },
  {
    id: 'E-NIMBUS-001', title: 'Official documentation registry', domain: 'verified-source-registry', type: 'registry',
    excerpt: 'No official source for the requested Nimbus endpoint is present in the configured evidence registry.',
    supports: ['nimbus endpoint is unverified'], contradicts: ['nimbus api exposes quantum_cache_flush'], reliability: 0.92
  },
  {
    id: 'E-DB-001', title: 'Database selection decision record', domain: 'verification-policy', type: 'methodology',
    excerpt: 'A database recommendation requires workload, access patterns, consistency, latency, scale, budget, and operational constraints.',
    supports: ['database choice depends on workload and constraints'], contradicts: [], reliability: 0.88
  }
];

const SCENARIOS = [
  { id: 'simple', title: 'Simple Question', description: 'Independent math answers are checked deterministically.', task: 'What is 25 * 48?', tab: 'Math' },
  { id: 'hallucination', title: 'Hallucination Test', description: 'Detect an unsupported fictional API claim.', task: 'Does the Nimbus API expose quantum_cache_flush?', tab: 'Research' },
  { id: 'conflict', title: 'Conflicting Answers', description: 'Investigate a model disagreement using evidence.', task: 'Is Redis a relational SQL database?', tab: 'Research' },
  { id: 'coding', title: 'Coding Verification', description: 'Require isolated tests before accepting code.', task: 'Write a function that adds two numbers and verify it.', tab: 'Code' },
  { id: 'misleading-document', title: 'Misleading Document', description: 'Challenge an unsupported statement in supplied material.', task: 'Verify this claim: Redis is a relational SQL database.', tab: 'Document' },
  { id: 'ambiguous', title: 'Ambiguous Question', description: 'Surface missing decision criteria before advising.', task: 'Which database is best?', tab: 'Ask' },
  { id: 'insufficient', title: 'Insufficient Evidence', description: 'Decline an unreliable prediction clearly.', task: 'Will Project Aurora definitely win next year?', tab: 'Research' },
  { id: 'self-correction', title: 'Self-Correction', description: 'Detect a math error, correct it, and re-check.', task: 'Calculate 25 * 48.', tab: 'Math' },
  { id: 'api', title: 'API Verification', description: 'Check a proposed endpoint against a trusted registry.', task: 'Use the Nimbus quantum_cache_flush API endpoint.', tab: 'Research' }
];

// Verification depth is selected per run. It never changes the server-wide
// limits, so an existing deployment keeps its current routing behaviour unless
// a caller explicitly chooses a different depth.
const VERIFICATION_PROFILES = {
  quick: { label: 'Quick', modelCount: 3, minSuccessfulModels: 1, maxModelCalls: 3, adaptive: false },
  balanced: { label: 'Balanced', modelCount: null, minSuccessfulModels: null, maxModelCalls: null, adaptive: true },
  deep: { label: 'Deep verification', modelCount: 8, minSuccessfulModels: 3, maxModelCalls: 8, adaptive: true },
  maximum: { label: 'Maximum verification', modelCount: 12, minSuccessfulModels: 4, maxModelCalls: 12, adaptive: true }
};

// The run ledger keeps the orchestration roles explicit and auditable. A role
// can be not-required for a task, but it is never silently omitted.
const AGENT_RESPONSIBILITIES = {
  planner: 'Classifies the request and creates the verification plan.',
  router: 'Selects task-capable, independent model perspectives.',
  'reasoning-agents': 'Generate independent answers without seeing peer responses.',
  'evidence-researcher': 'Links claims to supplied, curated, or deterministic evidence.',
  verifier: 'Checks claims against evidence and deterministic results.',
  critic: 'Challenges unsupported claims and contradictions.',
  safety: 'Assesses unsafe actions and untrusted instruction patterns.',
  'tool-agent': 'Runs bounded arithmetic or isolated code checks when applicable.',
  correction: 'Routes deterministic failures through a bounded re-verification loop.',
  finalizer: 'Synthesizes only the evidence-bounded result and its limitations.'
};

function recordAgent(run, role, status, detail, data = {}) {
  const record = {
    role,
    responsibility: AGENT_RESPONSIBILITIES[role] || 'Performs a bounded orchestration responsibility.',
    status,
    detail: String(detail || ''),
    at: now(),
    ...data
  };
  const index = run.agentLedger.findIndex((item) => item.role === role);
  if (index >= 0) run.agentLedger[index] = { ...run.agentLedger[index], ...record };
  else run.agentLedger.push(record);
  return record;
}

function initialAgentLedger() {
  return Object.entries(AGENT_RESPONSIBILITIES).map(([role, responsibility]) => ({
    role,
    responsibility,
    status: 'pending',
    detail: 'Awaiting this run stage.',
    at: null
  }));
}

function verificationProfile(task = {}) {
  const selected = VERIFICATION_PROFILES[task.verificationMode] || VERIFICATION_PROFILES.balanced;
  return {
    ...selected,
    mode: VERIFICATION_PROFILES[task.verificationMode] ? task.verificationMode : 'balanced',
    modelCount: Math.min(selected.modelCount || config.modelCount, config.maxModelCalls),
    minSuccessfulModels: Math.min(selected.minSuccessfulModels || config.minSuccessfulModels, config.maxModelCalls),
    maxModelCalls: Math.min(selected.maxModelCalls || config.maxModelCalls, config.maxModelCalls)
  };
}

function scenarioById(value) { return SCENARIOS.find((scenario) => scenario.id === value); }

function parseTask(body) {
  if (!body || typeof body !== 'object') throw inputError('A JSON request body is required.');
  const rawText = stripControlCharacters(body.task || '').trim();
  const documents = normalizeDocuments(body.documents);
  if (!rawText && !documents.length) throw inputError('Enter a task or attach a file or image before running an analysis.');
  if (rawText.length > config.maxInputChars) throw inputError(`Task exceeds the ${config.maxInputChars.toLocaleString()} character limit.`);
  const scenario = scenarioById(String(body.scenario || ''));
  const text = scenario ? scenario.task : rawText || 'Analyze the attached file or image and describe the important findings.';
  const categories = classify(text, body.mode, documents);
  const injectionFindings = documents.flatMap((document) => detectInjection(document.content).map((pattern) => ({ document: document.name, pattern })));
  const math = extractMath(text);
  const code = extractCode(text);
  return {
    text, originalText: rawText, mode: ['Ask', 'Research', 'Code', 'Document', 'Math'].includes(body.mode) ? body.mode : 'Ask',
    poolMode: ['smart', 'full', 'custom'].includes(body.poolMode) ? body.poolMode : 'smart',
    verificationMode: Object.hasOwn(VERIFICATION_PROFILES, body.verificationMode) ? body.verificationMode : 'balanced',
    customModels: Array.isArray(body.customModels) ? body.customModels.map(String).slice(0, 12) : [],
    scenario: scenario?.id || inferScenario(text), documents, categories, injectionFindings,
    mathExpression: math?.expression, mathResult: math?.result, code, createdAt: now()
  };
}

function inputError(message) { const error = new Error(message); error.statusCode = 400; return error; }

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  if (documents.length > 5) throw inputError('A maximum of five documents can be analyzed in one run.');
  return documents.map((document, index) => {
    const name = stripControlCharacters(document?.name || `Document ${index + 1}`).slice(0, 120);
    const type = String(document?.type || 'text/plain').toLowerCase();
    if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) {
      const imageData = String(document?.imageData || document?.content || '');
      const match = imageData.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
      if (!match || match[1].toLowerCase() !== type) throw inputError(`${name}: the image data is invalid.`);
      const bytes = Buffer.byteLength(match[2].replace(/\s/g, ''), 'base64');
      if (!bytes || bytes > config.maxFileBytes) throw inputError(`${name}: image exceeds the allowed size.`);
      return { id: `D${index + 1}`, name, type, kind: 'image', content: `[Untrusted image attachment: ${name}]`, imageData };
    }
    const content = stripControlCharacters(document?.content || '');
    if (!['text/plain', 'text/markdown', 'application/json', 'text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(type)) throw inputError(`${name}: upload TXT, Markdown, JSON, CSV, PDF, DOCX, or a supported image.`);
    if (!content.trim()) throw inputError(`${name}: the extracted text is empty.`);
    if (content.length > config.maxDocumentChars) throw inputError(`${name}: document text exceeds the allowed size.`);
    return { id: `D${index + 1}`, name, type, kind: 'text', content };
  });
}

function classify(text, selectedMode, documents) {
  const lower = text.toLowerCase();
  const groups = new Set();
  if (selectedMode === 'Code' || /\b(code|function|bug|debug|javascript|python|java|compile|algorithm)\b/.test(lower)) groups.add('coding');
  if (selectedMode === 'Math' || /\b(calculate|solve|equation|percent|average|ratio)\b/.test(lower) || /\d+\s*[+\-*/]\s*\d+/.test(lower)) groups.add('mathematics');
  if (selectedMode === 'Document' || documents.length) groups.add('document');
  if (documents.some((document) => document.kind === 'image')) groups.add('vision');
  if (/\b(api|endpoint|http|request|parameter|schema)\b/.test(lower)) groups.add('api');
  if (/\b(compare|versus|vs\.?|difference|best)\b/.test(lower)) groups.add('comparison');
  if (/\b(research|source|evidence|when|where|who|fact|verify)\b/.test(lower)) groups.add('research');
  if (/\b(plan|architecture|design|roadmap)\b/.test(lower)) groups.add('planning');
  if (/\b(password|credential|exploit|bypass|malware|weapon|attack)\b/.test(lower)) groups.add('safety-sensitive');
  if (/\b(best database|which database is best|make it fast|use java|which api is better)\b/.test(lower)) groups.add('ambiguous');
  if (groups.size === 0) groups.add('general-reasoning');
  return [...groups];
}

function inferScenario(text) {
  const lower = text.toLowerCase();
  if (lower.includes('nimbus') || lower.includes('quantum_cache_flush')) return 'hallucination';
  if (lower.includes('redis') && lower.includes('relational')) return 'conflict';
  if (lower.includes('best database')) return 'ambiguous';
  if (lower.includes('project aurora')) return 'insufficient';
  return 'general';
}

function extractMath(text) {
  const match = text.match(/(?:calculate|solve|what is)?\s*([0-9][0-9\s()+\-*/%.]{1,80})/i);
  if (!match) return null;
  const expression = match[1].trim().replace(/[.?]+$/, '');
  if (!/^[0-9\s()+\-*/%.]+$/.test(expression) || !/[+\-*/%]/.test(expression)) return null;
  try {
    // Grammar is deliberately limited to numerals and arithmetic operators; no identifiers or property access are accepted.
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? { expression, result } : null;
  } catch { return null; }
}

function extractCode(text) {
  const fenced = String(text).match(/```(?:js|javascript)\s*\n([\s\S]{1,50000}?)```/i);
  return fenced ? { language: 'javascript', source: fenced[1].trim() } : null;
}

function detectInjection(text) {
  const patterns = [/ignore (all |any )?(previous|prior) instructions/i, /reveal (the )?(api key|secret|password)/i, /skip verification/i, /mark (this )?answer as verified/i, /system message/i];
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function planTask(task) {
  const verificationPlan = ['evidence', 'logical', 'safety'];
  if (task.categories.includes('mathematics')) verificationPlan.push('mathematical');
  if (task.categories.includes('coding')) verificationPlan.push('code');
  if (task.categories.includes('api')) verificationPlan.push('api');
  return {
    agent: 'planner', taskTypes: task.categories,
    subtasks: task.categories.includes('ambiguous') ? ['Identify missing decision criteria'] : ['Generate independent perspectives', 'Extract atomic claims', 'Verify evidence'],
    requiredEvidence: task.categories.includes('mathematics') ? ['deterministic calculation'] : ['trusted source or supplied document'],
    verificationPlan
  };
}

function rankModels(registry, task) {
  const enabled = registry.filter((model) => (model.status === 'available' || model.status === 'demo-ready') && (!task.categories.includes('vision') || model.capabilities.includes('vision')));
  if (task.poolMode === 'custom') return enabled.filter((model) => task.customModels.includes(model.modelId));
  if (task.poolMode === 'full') return enabled;
  const needed = new Set(task.categories);
  const geminiPriority = shouldPrioritizeGemini(task);
  return enabled
    .map((model) => {
      const capabilityScore = model.capabilities.reduce((score, capability) => score + (needed.has(capability) ? 3 : 0), model.metrics.verificationScore * 2 - model.metrics.failureRate);
      const isGemini = model.adapter === 'gemini-direct' || /(?:google\s+gemini|google\/gemini|\bgemini\b)/i.test(`${model.provider} ${model.modelId}`);
      // Complex coding, research, document, and visual work benefits from a
      // Gemini perspective. A direct Gemini key wins the preference because it
      // is an independently configured provider; an OpenRouter Gemini model is
      // still favored when it is the available route.
      const geminiBoost = geminiPriority && isGemini ? (model.adapter === 'gemini-direct' ? 60 : 18) : 0;
      // Code mode has a deliberate primary generator. NVIDIA remains first for
      // implementation generation, while the other Smart Pool perspectives can
      // still review and verify it. Custom and Full pools return above unchanged.
      const nvidiaCodeBoost = task.mode === 'Code' && /nvidia/i.test(`${model.provider} ${model.modelId}`) && model.capabilities.includes('coding') ? 100 : 0;
      return { model, score: capabilityScore + geminiBoost + nvidiaCodeBoost };
    })
    .sort((a, b) => b.score - a.score || a.model.priority - b.model.priority)
    .map(({ model }) => model);
}

function shouldPrioritizeGemini(task) {
  const complexCategories = new Set(['coding', 'planning', 'research', 'document', 'vision', 'api', 'comparison']);
  const documentSize = (task.documents || []).reduce((total, document) => total + String(document.content || '').length, 0);
  return task.categories.some((category) => complexCategories.has(category)) || String(task.text || '').length >= 700 || documentSize >= 1600;
}

function selectModels(registry, task) {
  const ranked = rankModels(registry, task);
  return task.poolMode === 'smart' ? ranked.slice(0, verificationProfile(task).modelCount) : ranked;
}

async function mapWithConcurrency(items, worker, concurrency = config.modelConcurrency) {
  const results = Array(items.length);
  let cursor = 0;
  const next = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, next));
  return results;
}

function answeredResponses(responses = []) {
  return responses.filter((response) => response?.status === 'success' && String(response.answer || '').trim());
}

function responseParticipation(responses = []) {
  const keyFor = (response) => `${response.provider || 'unknown'}:${response.modelId || response.id || 'unknown'}`;
  const attempted = new Set(responses.filter(Boolean).map(keyFor));
  const responded = new Set(answeredResponses(responses).map(keyFor));
  return {
    respondingModels: responded.size,
    attemptedModels: attempted.size,
    nonRespondingModels: Math.max(0, attempted.size - responded.size)
  };
}

function consolidateClaims(responses) {
  const buckets = [];
  for (const response of answeredResponses(responses)) {
    for (const claim of response.claims) {
      const normalized = normalizeClaim(claim.text);
      let bucket = buckets.find((candidate) => candidate.normalized === normalized || semanticMatch(candidate.normalized, normalized));
      if (!bucket) {
        bucket = { id: `C${buckets.length + 1}`, normalized, text: claim.text, type: claim.type, modelIds: [], sourceClaims: [], status: 'pending', evidenceIds: [], confidence: 0, issues: [] };
        buckets.push(bucket);
      }
      if (!bucket.modelIds.includes(response.modelId)) bucket.modelIds.push(response.modelId);
      bucket.sourceClaims.push({ responseId: response.id, modelId: response.modelId, text: claim.text });
    }
  }
  return buckets;
}

function normalizeClaim(value) { return String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function semanticMatch(a, b) { return a && b && (a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) > 20; }

function retrieveEvidence(claims, task) {
  const evidence = [];
  const add = (item, claimId, relation = 'supports') => {
    const found = evidence.find((candidate) => candidate.id === item.id && candidate.claimIds.includes(claimId) && candidate.relation === relation);
    if (!found) evidence.push({ ...item, claimIds: [claimId], relation, retrievedAt: now(), relevance: item.reliability, freshness: evidenceFreshness(item) });
  };
  for (const claim of claims) {
    const normalized = claim.normalized;
    for (const item of KNOWN_EVIDENCE) {
      if (item.supports.some((phrase) => {
        const comparable = normalizeClaim(phrase);
        return normalized.includes(comparable) || comparable.includes(normalized);
      })) add(item, claim.id, 'supports');
      if (item.contradicts.some((phrase) => {
        const comparable = normalizeClaim(phrase);
        return normalized.includes(comparable) || comparable.includes(normalized);
      })) add(item, claim.id, 'contradicts');
    }
    if (task.mathExpression && (claim.type === 'mathematical' || /equals|=/.test(claim.text))) {
      add({ id: `E-MATH-${claim.id}`, title: 'Deterministic arithmetic checker', domain: 'local-tool', type: 'deterministic-tool', excerpt: `${task.mathExpression} = ${task.mathResult}`, supports: [], contradicts: [], reliability: 1 }, claim.id);
    }
    for (const document of task.documents) {
      const contains = document.content.toLowerCase().includes(claim.text.toLowerCase().slice(0, 30));
      if (contains) add({ id: `E-${document.id}-${claim.id}`, title: document.name, domain: 'user-supplied', type: 'untrusted-document', excerpt: document.content.slice(0, 280), supports: [], contradicts: [], reliability: 0.35 }, claim.id);
    }
  }
  return evidence;
}

function evidenceFreshness(item = {}) {
  // Curated records without a source date are deliberately labelled unknown;
  // the interface must not imply that retrieval time is publication time.
  if (!item.updatedAt && !item.publishedAt) return { state: 'unknown', label: 'Date not supplied', updatedAt: null };
  const timestamp = new Date(item.updatedAt || item.publishedAt).getTime();
  if (!Number.isFinite(timestamp)) return { state: 'unknown', label: 'Date not supplied', updatedAt: null };
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  const state = days <= 30 ? 'high' : days <= 365 ? 'moderate' : 'low';
  return { state, label: days === 0 ? 'Updated today' : `Updated ${days} day${days === 1 ? '' : 's'} ago`, updatedAt: item.updatedAt || item.publishedAt };
}

function verifyClaims(claims, evidence, responses, task) {
  const modelCount = Math.max(responseParticipation(responses).respondingModels, 1);
  const contradictions = [];
  for (const claim of claims) {
    const related = evidence.filter((item) => item.claimIds.includes(claim.id));
    const supports = related.filter((item) => item.relation === 'supports');
    const contradicts = related.filter((item) => item.relation === 'contradicts');
    const answerContradictsMath = Boolean(task.mathExpression && claim.type === 'mathematical' && !containsNumber(claim.text, task.mathResult));
    const unsupported = supports.length === 0 || (supports.every((item) => item.reliability < config.evidenceThreshold) && !task.mathExpression);
    claim.evidenceIds = related.map((item) => item.id);
    claim.agreement = { supporters: claim.modelIds.length, total: modelCount };
    if (contradicts.length || answerContradictsMath) {
      claim.status = 'rejected';
      claim.issues.push(answerContradictsMath ? 'Deterministic calculation mismatch.' : 'Trusted evidence contradicts this claim.');
      contradictions.push({ id: `X${contradictions.length + 1}`, claimId: claim.id, severity: answerContradictsMath ? 'high' : 'high', status: 'resolved', reason: claim.issues[claim.issues.length - 1], evidenceIds: related.filter((item) => item.relation === 'contradicts').map((item) => item.id) });
    } else if (unsupported) {
      claim.status = 'unsupported';
      claim.issues.push('No sufficiently reliable supporting evidence was found.');
    } else {
      claim.status = 'verified';
    }
    claim.confidence = claimConfidence(claim, supports, contradicts, Boolean(task.mathExpression));
  }
  return contradictions;
}

function containsNumber(text, expected) {
  const normalizedExpected = Number(expected).toLocaleString('en-US').replace(/,/g, '');
  return String(text).replace(/,/g, '').includes(normalizedExpected);
}

function claimConfidence(claim, supports, contradicts, deterministic) {
  const agreement = claim.agreement.supporters / claim.agreement.total;
  const evidenceStrength = supports.length ? Math.max(...supports.map((item) => item.reliability)) : 0;
  let score = 0.12 + evidenceStrength * 0.52 + agreement * 0.20 + (deterministic ? 0.15 : 0);
  score -= contradicts.length * 0.45;
  if (claim.status === 'unsupported') score = Math.min(score, 0.48);
  if (claim.status === 'rejected') score = Math.min(score, 0.18);
  return Math.round(clamp(score, 0.02, 0.98) * 100);
}

function buildChecks(task, claims, contradictions, codeResult = null) {
  const verified = claims.filter((claim) => claim.status === 'verified').length;
  const unsupported = claims.filter((claim) => claim.status === 'unsupported').length;
  const injectionBlocked = task.injectionFindings.length > 0;
  const checks = [
    { type: 'Factual', status: verified ? 'pass' : unsupported ? 'warning' : 'not-verified', detail: verified ? `${verified} claim(s) supported by evidence.` : 'No factual claim met the evidence threshold.' },
    { type: 'Logical', status: contradictions.length ? 'warning' : 'pass', detail: contradictions.length ? `${contradictions.length} contradiction(s) investigated.` : 'No internal contradiction found in consolidated claims.' },
    { type: 'Evidence', status: verified ? 'pass' : 'warning', detail: `${verified}/${claims.length || 0} claim(s) independently supported.` },
    { type: 'Safety', status: injectionBlocked ? 'warning' : 'pass', detail: injectionBlocked ? 'Prompt-injection-like text was isolated as untrusted document data.' : 'No blocked unsafe action was detected.' }
  ];
  if (task.categories.includes('mathematics')) checks.push({ type: 'Mathematical', status: task.mathExpression ? 'pass' : 'not-verified', detail: task.mathExpression ? `Independent result: ${task.mathExpression} = ${task.mathResult}.` : 'No safely parseable expression was found.' });
  if (task.categories.includes('coding')) checks.push({ type: 'Code', status: codeResult?.status === 'passed' ? 'pass' : codeResult?.status === 'failed' || codeResult?.status === 'blocked' ? 'failed' : 'not-verified', detail: codeResult?.detail || (config.sandboxEnabled ? 'No executable JavaScript block was supplied for isolated execution.' : 'Sandbox is not configured; generated code was not executed.') });
  if (task.categories.includes('api')) checks.push({ type: 'API', status: claims.some((claim) => claim.status === 'rejected') ? 'pass' : 'not-verified', detail: 'API claims were checked against the configured evidence registry.' });
  return checks;
}

function safetyAssessment(task) {
  const dangerous = /\b(exploit|bypass authentication|steal|malware|ransomware|credential harvesting)\b/i.test(task.text);
  return { risk: dangerous ? 'high' : task.injectionFindings.length ? 'medium' : 'low', blocked: dangerous, findings: task.injectionFindings.map((item) => `Untrusted instruction pattern in ${item.document}.`) };
}

function collectAssumptions(task, responses) {
  const values = responses.flatMap((response) => response.assumptions || []).map((item) => String(item).trim()).filter(Boolean);
  if (task.categories.includes('ambiguous')) values.push('The task does not specify the decision criteria required for a single recommendation.');
  if (task.categories.includes('planning') || task.categories.includes('comparison')) values.push('Trade-offs depend on the stated requirements and operating constraints.');
  return [...new Set(values)].slice(0, 12);
}

function decisionConditions(task, assumptions, claims) {
  const conditions = [];
  if (assumptions.length) conditions.push(...assumptions.map((assumption) => `The conclusion should be revisited if this assumption changes: ${assumption}`));
  if (task.categories.includes('api')) conditions.push('Authoritative API documentation, including version and authentication details, could change this conclusion.');
  if (task.categories.includes('coding')) conditions.push('A hardened execution result or edge-case test could change this conclusion.');
  if (task.categories.includes('research')) conditions.push('New or more authoritative evidence could change this conclusion.');
  if (claims.some((claim) => claim.status === 'unsupported')) conditions.push('Reliable supporting evidence for currently unsupported claims could change this conclusion.');
  return [...new Set(conditions)].slice(0, 8);
}

function counterexamplesFor(task, claims) {
  const candidates = [];
  for (const claim of claims.filter((item) => item.status !== 'rejected').slice(0, 4)) {
    if (/all|always|never|every|best|only/i.test(claim.text)) candidates.push({ claimId: claim.id, text: 'Test this claim against a materially different workload, constraint set, or edge case before treating it as universal.', status: 'needs-verification' });
  }
  if (task.categories.includes('planning') || task.categories.includes('comparison') || task.categories.includes('ambiguous')) candidates.push({ claimId: null, text: 'Consider a write-heavy, latency-sensitive, or low-budget operating case; a recommendation may change under those constraints.', status: 'needs-verification' });
  if (task.categories.includes('coding')) candidates.push({ claimId: null, text: 'Test empty inputs, boundary values, invalid input, and concurrent calls before relying on generated code.', status: 'needs-verification' });
  return candidates.slice(0, 5);
}

function redTeamAssessment(task, claims, contradictions, codeResult = null) {
  const findings = [];
  for (const claim of claims.filter((item) => item.status === 'unsupported')) findings.push({ severity: 'medium', claimId: claim.id, type: 'missing-evidence', detail: `${claim.id} is not supported by sufficiently reliable evidence.` });
  for (const claim of claims.filter((item) => item.status === 'rejected')) findings.push({ severity: 'high', claimId: claim.id, type: 'contradicted-claim', detail: `${claim.id} conflicts with trusted evidence or a deterministic check.` });
  for (const contradiction of contradictions.filter((item) => item.status !== 'resolved')) findings.push({ severity: contradiction.severity || 'high', claimId: contradiction.claimId, type: 'unresolved-contradiction', detail: contradiction.reason });
  if (task.injectionFindings.length) findings.push({ severity: 'medium', claimId: null, type: 'untrusted-instruction', detail: 'Prompt-injection-like content was kept as untrusted data and could not change the verification policy.' });
  if (task.categories.includes('coding') && codeResult?.status !== 'passed') findings.push({ severity: 'medium', claimId: null, type: 'unverified-code', detail: 'Generated or supplied code has not passed the hardened execution check.' });
  return {
    agent: 'red-team',
    status: findings.some((item) => item.severity === 'high') ? 'findings' : findings.length ? 'review' : 'clear',
    findings,
    checkedAt: now(),
    note: 'This rule-based red-team pass challenges evidence, contradictions, safety boundaries, and executable-code checks; it does not turn model agreement into proof.'
  };
}

function modelContributions(responses, claims) {
  const lookup = new Map(answeredResponses(responses).map((response) => [`${response.provider}:${response.modelId}`, response]));
  return [...lookup.values()].map((response) => {
    const contributed = claims.filter((claim) => claim.modelIds.includes(response.modelId));
    return {
      modelId: response.modelId,
      provider: response.provider,
      acceptedClaims: contributed.filter((claim) => claim.status === 'verified').map((claim) => claim.id),
      limitedClaims: contributed.filter((claim) => claim.status !== 'verified').map((claim) => claim.id),
      latencyMs: response.latencyMs
    };
  });
}

function disagreementSummary(claims, responses) {
  const responders = answeredResponses(responses);
  const successful = Math.max(1, responseParticipation(responders).respondingModels);
  const items = claims.map((claim) => ({ claimId: claim.id, supporters: claim.modelIds.length, total: successful, agreement: Math.round(claim.modelIds.length / successful * 100), status: claim.status }));
  const agreement = items.length ? Math.round(items.reduce((total, item) => total + item.agreement, 0) / items.length) : 0;
  return { agreement, disagreement: Math.max(0, 100 - agreement), respondingModels: successful, items, outlierModels: responders.filter((response) => !claims.some((claim) => claim.modelIds.includes(response.modelId) && claim.modelIds.length > 1)).map((response) => response.modelId) };
}

function correctClaims(task, claims, corrections) {
  const rejectedMath = claims.filter((claim) => claim.type === 'mathematical' && claim.status === 'rejected');
  if (!rejectedMath.length || corrections.length >= config.maxCorrectionLoops) return false;
  for (const claim of rejectedMath) {
    corrections.push({ id: `R${corrections.length + 1}`, attempt: corrections.length + 1, routedTo: 'tool-agent', issue: claim.issues[0], action: `Recomputed ${task.mathExpression} using deterministic arithmetic.`, result: `Corrected result: ${task.mathResult}.`, reverified: true, at: now() });
    claim.text = `${task.mathExpression} equals ${task.mathResult}.`;
    claim.normalized = normalizeClaim(claim.text);
    claim.status = 'verified'; claim.issues = ['Corrected by deterministic calculation and re-verified.']; claim.confidence = 98;
  }
  return true;
}

function calculateRunConfidence(claims, checks, contradictions, safety, responses = []) {
  const total = Math.max(claims.length, 1);
  const verifiedRatio = claims.filter((claim) => claim.status === 'verified').length / total;
  const evidenceCoverage = claims.filter((claim) => claim.evidenceIds.length > 0).length / total;
  const agreement = claims.reduce((sum, claim) => sum + (claim.agreement?.supporters || 0) / Math.max(claim.agreement?.total || 1, 1), 0) / total;
  const checkPass = checks.filter((check) => check.status === 'pass').length / Math.max(checks.length, 1);
  let score = 0.1 + verifiedRatio * 0.34 + evidenceCoverage * 0.24 + agreement * 0.10 + checkPass * 0.22 - contradictions.length * 0.12;
  if (safety.blocked) score = 0;
  if (evidenceCoverage < config.evidenceThreshold) score = Math.min(score, 0.69);
  return { score: Math.round(clamp(score, 0, 0.98) * 100), evidenceCoverage: Math.round(evidenceCoverage * 100), modelAgreement: Math.round(agreement * 100), verificationQuality: Math.round(checkPass * 100), ...responseParticipation(responses) };
}

function decide(task, claims, checks, contradictions, safety, confidence, codeResult = null) {
  const verified = claims.filter((claim) => claim.status === 'verified').length;
  const unsupported = claims.filter((claim) => claim.status === 'unsupported').length;
  const critical = contradictions.some((item) => ['critical'].includes(item.severity) && item.status !== 'resolved');
  if (safety.blocked) return { status: 'rejected', title: 'REJECTED', reason: 'The safety policy blocked a high-risk request before execution.' };
  if (task.categories.includes('ambiguous')) return { status: 'needs-more-evidence', title: 'NEEDS MORE EVIDENCE', reason: 'Key decision criteria are missing; the platform will not invent a universal recommendation.' };
  if (task.scenario === 'insufficient') return { status: 'needs-more-evidence', title: 'NEEDS MORE EVIDENCE', reason: 'Independent evidence is unavailable, so a reliable conclusion would be speculative.' };
  if (task.categories.includes('coding') && !config.sandboxEnabled) return { status: 'verified-with-limitations', title: 'VERIFIED WITH LIMITATIONS', reason: 'The reasoning was reviewed, but no hardened sandbox was available to execute generated code.' };
  if (task.categories.includes('coding') && codeResult?.status !== 'passed') return { status: 'needs-more-evidence', title: 'NEEDS MORE EVIDENCE', reason: 'Code did not complete the required hardened sandbox verification.' };
  if (critical || (!verified && unsupported)) return { status: 'needs-more-evidence', title: 'NEEDS MORE EVIDENCE', reason: 'The available evidence cannot resolve the important claims safely.' };
  if (unsupported || contradictions.length || confidence.score < config.confidenceThreshold * 100) return { status: 'verified-with-limitations', title: 'VERIFIED WITH LIMITATIONS', reason: 'Supported claims are retained; unresolved or unsupported information is explicitly limited.' };
  return { status: 'verified', title: 'VERIFIED', reason: 'Evidence, independent checks, and safety requirements passed for the accepted claims.' };
}

function representativePerspective(responses, claims) {
  const verifiedTexts = new Set(claims.filter((claim) => claim.status === 'verified').flatMap((claim) => claim.sourceClaims.map((source) => source.text)));
  return answeredResponses(responses).sort((first, second) => {
    const firstVerified = first.claims.filter((claim) => verifiedTexts.has(claim.text)).length;
    const secondVerified = second.claims.filter((claim) => verifiedTexts.has(claim.text)).length;
    return secondVerified - firstVerified || first.latencyMs - second.latencyMs;
  })[0] || null;
}

function needsDetailedAnswer(task = {}) {
  const detailedCategories = new Set(['coding', 'planning', 'research', 'document', 'vision', 'api', 'comparison']);
  return task.verificationMode === 'deep' || task.verificationMode === 'maximum' || (task.categories || []).some((category) => detailedCategories.has(category)) || String(task.text || '').length >= 700;
}

function boundedConclusion(task, answer) {
  const limit = needsDetailedAnswer(task) ? config.complexFinalAnswerMaxChars : config.finalAnswerMaxChars;
  const text = String(answer || '').trim();
  return text.length > limit ? `${text.slice(0, limit)}\n\n[The displayed answer reached this run's configured limit. Open the model perspective or export the audit to inspect the complete response.]` : text;
}

function finalAnswer(task, claims, decision, evidence, confidence, responses, geminiReview = null) {
  const verified = claims.filter((claim) => claim.status === 'verified');
  const perspective = representativePerspective(responses, claims);
  let conclusion;
  let answerKind = 'verified';
  if (decision.status === 'rejected') {
    conclusion = 'This request was not processed because it falls outside the platform safety policy.';
    answerKind = 'blocked';
  }
  else if (task.categories.includes('mathematics') && task.mathExpression) conclusion = `${task.mathExpression} = ${task.mathResult}. This result was independently calculated.`;
  else if (task.scenario === 'conflict' || task.scenario === 'misleading-document') conclusion = 'Redis is not a relational SQL database. The trusted reference describes it as an in-memory data structure store.';
  else if (task.scenario === 'hallucination' || task.scenario === 'api') conclusion = 'The requested Nimbus endpoint cannot be verified from an official source in the configured evidence registry. Do not rely on it without authoritative documentation.';
  else if (task.scenario === 'ambiguous') conclusion = 'There is no universally best database. Share workload, data model, consistency, latency, scale, budget, and operational constraints for a defensible recommendation.';
  else if (task.scenario === 'insufficient') conclusion = 'I cannot make that prediction reliably with the available evidence.';
  else if (geminiReview?.status === 'success' && geminiReview.answer && decision.status !== 'rejected') {
    conclusion = boundedConclusion(task, geminiReview.answer);
    answerKind = 'gemini-reviewed';
  }
  else if (needsDetailedAnswer(task) && perspective?.answer) {
    conclusion = boundedConclusion(task, perspective.answer);
    answerKind = 'provisional';
  }
  else if (verified.length) conclusion = verified.map((claim) => claim.text).join(' ');
  else if (perspective) {
    conclusion = boundedConclusion(task, perspective.answer);
    answerKind = 'provisional';
  } else {
    conclusion = 'No evidence-supported conclusion is available for this task.';
    answerKind = 'unavailable';
  }
  return {
    conclusion, supportingEvidence: evidence.filter((item) => item.relation === 'supports').map((item) => ({ id: item.id, title: item.title, type: item.type })).slice(0, 5),
    limitations: [decision.status === 'verified' ? 'Model agreement was considered a perspective, not proof.' : decision.reason, ...claims.filter((claim) => claim.status !== 'verified').map((claim) => `${claim.id}: ${claim.issues[0]}`).slice(0, 3)],
    verificationStatus: decision.title, confidence: confidence.score, answerKind,
    perspectiveProvider: answerKind === 'provisional' ? perspective.provider : answerKind === 'gemini-reviewed' ? geminiReview.provider : null
  };
}

async function executeRun({ run, gateway, publish }) {
  const emit = (stage, message, data = {}) => publish(run.id, { at: now(), stage, message, ...data });
  try {
    const profile = verificationProfile(run.task);
    run.verificationProfile = profile;
    emit('task-analysis', 'Task analyzed');
    await sleep(80);
    run.plan = planTask(run.task);
    recordAgent(run, 'planner', 'complete', `Classified: ${run.task.categories.join(', ')}. Planned: ${run.plan.verificationPlan.join(', ')}.`);
    emit('planning', 'Verification plan created', { plan: run.plan });
    run.safety = safetyAssessment(run.task);
    if (run.safety.blocked) {
      const detail = 'A high-risk request was blocked before any model or tool call.';
      recordAgent(run, 'safety', 'blocked', detail);
      for (const role of ['router', 'reasoning-agents', 'evidence-researcher', 'verifier', 'tool-agent', 'correction']) recordAgent(run, role, 'not-required', 'Safety policy stopped the run before this stage.');
      run.redTeam = { agent: 'red-team', status: 'blocked', findings: [{ severity: 'high', claimId: null, type: 'unsafe-action', detail }], checkedAt: now(), note: 'The safety gate stopped the request before generation.' };
      recordAgent(run, 'critic', 'limited', 'Safety policy identified a blocked unsafe action.');
      run.checks = buildChecks(run.task, [], [], null);
      run.participation = responseParticipation([]);
      run.confidence = calculateRunConfidence([], run.checks, [], run.safety, []);
      run.decision = decide(run.task, [], run.checks, [], run.safety, run.confidence);
      run.answerConditions = ['A safe, legitimate objective and sufficient context would be required before a new analysis can run.'];
      run.finalAnswer = finalAnswer(run.task, [], run.decision, [], run.confidence, []);
      recordAgent(run, 'finalizer', 'limited', `${run.decision.title}: ${run.decision.reason}`);
      run.status = 'complete'; run.completedAt = now();
      emit('safety', detail, { status: 'blocked' });
      emit('finalization', `${run.decision.title}: final synthesis complete`, { decision: run.decision });
      return;
    }
    const registry = await gateway.registry();
    const rankedModels = rankModels(registry, run.task);
    run.models = selectModels(registry, run.task).map((model) => ({ ...model, selection: 'primary' }));
    if (!run.models.length) throw new Error(run.task.categories.includes('vision') ? 'No vision-capable model is currently available. Connect or select a vision-capable model, then retry the image.' : 'No enabled models are currently available for this pool.');
    recordAgent(run, 'router', 'complete', `${run.models.length} model perspective(s) selected for the ${run.task.poolMode} pool.`, { modelIds: run.models.map((model) => model.modelId) });
    emit('model-routing', `${run.models.length} model perspectives selected`, { models: run.models.map((model) => model.modelId) });
    const requestPerspective = async (model, index, selection) => {
      emit('generation', `${model.provider} started`, { modelId: model.modelId, status: 'running' });
      const response = await gateway.generate(model, run.task, index);
      response.selection = selection;
      emit('generation', response.status === 'success' ? `${model.provider} responded` : `${model.provider} failed safely`, { modelId: model.modelId, status: response.status, selection });
      return response;
    };
    run.responses = await mapWithConcurrency(run.models, (model, index) => requestPerspective(model, index, 'primary'));
    const selectedIds = new Set(run.models.map((model) => model.modelId));
    const recoveryCandidates = rankModels(registry, { ...run.task, poolMode: 'smart' });
    const fallbackCandidates = recoveryCandidates.filter((model) => !selectedIds.has(model.modelId));
    const requiredSuccesses = Math.min(profile.minSuccessfulModels, Math.max(1, recoveryCandidates.length), profile.maxModelCalls);
    // A custom pool is an explicit provider boundary.  It must never silently
    // add another model after a failure; the user may have selected models for
    // cost, privacy, or comparison reasons.  Smart routing remains free to
    // recover with a healthy backup, while the full pool already contains all
    // eligible models.
    const canExpand = run.task.poolMode === 'smart';
    while (canExpand && profile.adaptive && run.responses.filter((response) => response.status === 'success').length < requiredSuccesses && run.models.length < profile.maxModelCalls && fallbackCandidates.length) {
      const healthy = run.responses.filter((response) => response.status === 'success').length;
      const slots = profile.maxModelCalls - run.models.length;
      const batchSize = Math.min(Math.max(requiredSuccesses - healthy, 1), slots, fallbackCandidates.length);
      const fallbacks = fallbackCandidates.splice(0, batchSize).map((model) => ({ ...model, selection: 'fallback' }));
      run.models.push(...fallbacks);
      emit('model-fallback', `${fallbacks.length} healthy backup model perspective(s) added after provider failure`, { models: fallbacks.map((model) => model.modelId) });
      const fallbackResponses = await mapWithConcurrency(fallbacks, (model, index) => requestPerspective(model, run.responses.length + index, 'fallback'));
      run.responses.push(...fallbackResponses);
    }
    emit('claim-extraction', 'Independent responses normalized and claims extracted');
    run.claims = consolidateClaims(run.responses);
    const initialDisagreement = disagreementSummary(run.claims, run.responses);
    const disagreementThreshold = Math.round(config.adaptiveDisagreementThreshold * 100);
    if (canExpand && profile.adaptive && initialDisagreement.disagreement >= disagreementThreshold && run.models.length < profile.maxModelCalls && fallbackCandidates.length) {
      const slots = profile.maxModelCalls - run.models.length;
      const batchSize = Math.min(Math.max(1, Math.ceil(initialDisagreement.disagreement / 50)), slots, fallbackCandidates.length);
      const adaptiveModels = fallbackCandidates.splice(0, batchSize).map((model) => ({ ...model, selection: 'adaptive' }));
      run.models.push(...adaptiveModels);
      emit('adaptive-verification', `${adaptiveModels.length} additional perspective(s) added after ${initialDisagreement.disagreement}% model disagreement`, { models: adaptiveModels.map((model) => model.modelId), disagreement: initialDisagreement.disagreement });
      const adaptiveResponses = await mapWithConcurrency(adaptiveModels, (model, index) => requestPerspective(model, run.responses.length + index, 'adaptive'));
      run.responses.push(...adaptiveResponses);
      run.claims = consolidateClaims(run.responses);
      recordAgent(run, 'router', 'complete', `${run.models.length} model perspective(s) selected; ${adaptiveModels.length} added for high disagreement.`, { modelIds: run.models.map((model) => model.modelId), disagreement: initialDisagreement.disagreement });
    }
    const failures = run.responses.filter((response) => response.status === 'failed');
    if (failures.length) run.failures.push(...failures.map((response) => ({ stage: 'generation', modelId: response.modelId, reason: response.errors[0], at: now() })));
    const successfulPerspectives = answeredResponses(run.responses);
    recordAgent(run, 'reasoning-agents', successfulPerspectives.length ? (successfulPerspectives.length === run.responses.length ? 'complete' : 'limited') : 'failed', `${successfulPerspectives.length}/${run.responses.length} selected model perspective(s) returned a usable answer.`, { modelIds: successfulPerspectives.map((response) => response.modelId) });
    if (!successfulPerspectives.length) throw new Error('All selected model requests failed or returned no answer. No answer was fabricated.');
    run.evidence = retrieveEvidence(run.claims, run.task);
    recordAgent(run, 'evidence-researcher', run.evidence.length ? 'complete' : 'limited', `${run.evidence.length} evidence item(s) linked to ${run.claims.length} normalized claim(s).`, { evidenceIds: run.evidence.map((item) => item.id) });
    emit('evidence', `${run.evidence.length} evidence item(s) retrieved and linked`);
    run.contradictions = verifyClaims(run.claims, run.evidence, run.responses, run.task);
    recordAgent(run, 'verifier', 'complete', `${run.claims.length} claim(s) checked; ${run.contradictions.length} contradiction(s) recorded.`);
    emit('verification', 'Independent verification checks completed', { contradictions: run.contradictions.length });
    emit('contradiction', run.contradictions.length ? `${run.contradictions.length} contradiction(s) identified for resolution` : 'No unresolved contradictions found', { contradictions: run.contradictions.length });
    run.corrections = [];
    if (correctClaims(run.task, run.claims, run.corrections)) {
      recordAgent(run, 'correction', 'complete', `${run.corrections.length} deterministic correction(s) were re-verified.`);
      emit('correction', 'A deterministic mismatch was corrected and re-verified', { count: run.corrections.length });
    } else recordAgent(run, 'correction', 'not-required', 'No deterministic correction was required.');
    if (run.task.categories.includes('coding') && run.task.code) {
      emit('sandbox', 'Submitting supplied JavaScript to the isolated execution policy');
      run.codeVerification = await runIsolatedJavaScript(run.task.code.source);
      emit('sandbox', `Sandbox status: ${run.codeVerification.status}`);
    } else run.codeVerification = null;
    const toolStatus = run.task.categories.includes('coding') ? (run.codeVerification?.status || 'not-verified') : run.task.categories.includes('mathematics') && run.task.mathExpression ? 'complete' : 'not-required';
    const toolDetail = run.task.categories.includes('coding') ? (run.codeVerification?.detail || 'No executable JavaScript block was supplied for isolated execution.') : run.task.categories.includes('mathematics') && run.task.mathExpression ? `Deterministic arithmetic checked ${run.task.mathExpression}.` : 'No deterministic or sandboxed tool execution was required.';
    recordAgent(run, 'tool-agent', toolStatus, toolDetail);
    run.safety = safetyAssessment(run.task);
    recordAgent(run, 'safety', run.safety.blocked ? 'blocked' : run.safety.risk === 'medium' ? 'limited' : 'complete', run.safety.blocked ? 'A high-risk action was blocked before execution.' : run.safety.findings.length ? run.safety.findings.join(' ') : 'No blocked unsafe action was detected.');
    run.checks = buildChecks(run.task, run.claims, run.contradictions, run.codeVerification);
    run.assumptions = collectAssumptions(run.task, run.responses);
    run.counterexamples = counterexamplesFor(run.task, run.claims);
    run.disagreement = disagreementSummary(run.claims, run.responses);
    run.contributions = modelContributions(run.responses, run.claims);
    run.redTeam = redTeamAssessment(run.task, run.claims, run.contradictions, run.codeVerification);
    recordAgent(run, 'critic', run.redTeam.status === 'clear' ? 'complete' : 'limited', run.redTeam.findings.length ? `${run.redTeam.findings.length} challenge finding(s) recorded.` : 'No additional blocking issue found.');
    emit('red-team', run.redTeam.findings.length ? `${run.redTeam.findings.length} red-team finding(s) recorded for review` : 'Red-team challenge found no additional blocking issue', { findings: run.redTeam.findings.length, status: run.redTeam.status });
    run.participation = responseParticipation(run.responses);
    run.confidence = calculateRunConfidence(run.claims, run.checks, run.contradictions, run.safety, run.responses);
    run.decision = decide(run.task, run.claims, run.checks, run.contradictions, run.safety, run.confidence, run.codeVerification);
    run.answerConditions = decisionConditions(run.task, run.assumptions, run.claims);
    run.geminiReview = null;
    const geminiReviewer = shouldPrioritizeGemini(run.task) && registry.find((model) => model.adapter === 'gemini-direct' && model.status === 'available');
    const reviewerWasSelected = geminiReviewer && run.task.customModels.includes(geminiReviewer.modelId);
    const mayUseGeminiReviewer = run.task.poolMode !== 'custom' || reviewerWasSelected;
    if (geminiReviewer && mayUseGeminiReviewer && typeof gateway.reviewWithGemini === 'function' && run.decision.status !== 'rejected') {
      emit('gemini-review', 'Google Gemini is checking the consolidated agent perspectives and verified claims', { modelId: geminiReviewer.modelId, status: 'running' });
      const review = await gateway.reviewWithGemini(geminiReviewer, run.task, { responses: run.responses, claims: run.claims, evidence: run.evidence, decision: run.decision });
      if (review.status === 'success' && review.answer) {
        run.geminiReview = review;
        emit('gemini-review', 'Google Gemini completed the final evidence-bounded review', { modelId: geminiReviewer.modelId, status: 'success' });
      } else emit('gemini-review', 'Google Gemini review was unavailable; the verified synthesis remains in use', { modelId: geminiReviewer.modelId, status: 'failed' });
    }
    run.finalAnswer = finalAnswer(run.task, run.claims, run.decision, run.evidence, run.confidence, run.responses, run.geminiReview);
    recordAgent(run, 'finalizer', run.decision.status === 'verified' ? 'complete' : 'limited', `${run.decision.title}: ${run.decision.reason}`);
    run.status = 'complete'; run.completedAt = now();
    emit('finalization', `${run.decision.title}: final synthesis complete`, { decision: run.decision });
  } catch (error) {
    const workflowError = String(error.message || error);
    run.failures.push({ stage: 'workflow', reason: workflowError, at: now() });
    const successfulResponses = answeredResponses(run.responses);
    const fallbackSafety = run.safety || safetyAssessment(run.task);
    const fallbackPerspective = representativePerspective(successfulResponses, run.claims || []);
    if (fallbackPerspective && !fallbackSafety.blocked) {
      // A failure in another provider or a later verification stage must not hide
      // a real response that the user can inspect. It is deliberately marked as
      // partial, with zero verification confidence, rather than accepted as fact.
      run.status = 'complete'; run.completedAt = now(); run.safety = fallbackSafety; run.participation = responseParticipation(run.responses);
      run.decision = { status: 'needs-more-evidence', title: 'PARTIAL RESULT', reason: 'At least one model produced an answer, but other model calls or a later verification stage failed. This response was retained for review and is not verified.' };
      run.confidence = run.confidence || { score: 0, evidenceCoverage: 0, modelAgreement: 0, verificationQuality: 0, ...run.participation };
      run.finalAnswer = {
        conclusion: boundedConclusion(run.task, fallbackPerspective.answer),
        supportingEvidence: (run.evidence || []).filter((item) => item.relation === 'supports').map((item) => ({ id: item.id, title: item.title, type: item.type })).slice(0, 5),
        limitations: [run.decision.reason, `Workflow error: ${workflowError.slice(0, 180)}`],
        verificationStatus: run.decision.title,
        confidence: 0,
        answerKind: 'provisional',
        perspectiveProvider: fallbackPerspective.provider
      };
      recordAgent(run, 'finalizer', 'limited', 'A successful model perspective was retained as a partial result after a later workflow failure.');
      try { emit('partial-result', 'A successful model answer was retained after other work failed; it requires review.', { provider: fallbackPerspective.provider, modelId: fallbackPerspective.modelId }); } catch { /* The event publisher may be the failed stage. */ }
      return;
    }
    run.status = 'failed'; run.completedAt = now();
    run.decision = { status: 'failed', title: 'FAILED', reason: 'The workflow could not complete and no safe successful model answer was available.' };
    recordAgent(run, 'finalizer', 'failed', 'No safe successful model answer was available for synthesis.');
    run.finalAnswer = { conclusion: 'The analysis could not complete safely. Review the visible audit trail and retry with available models.', supportingEvidence: [], limitations: [run.decision.reason], verificationStatus: 'FAILED', confidence: 0 };
    try { emit('failed', 'Workflow failed safely; no result was labeled verified.', { error: run.decision.reason }); } catch { /* Preserve the completed audit state when event delivery also failed. */ }
  }
}

function createRun(task) {
  return {
    id: id('RUN'), status: 'running', startedAt: now(), completedAt: null, task, plan: null, models: [], responses: [], claims: [], evidence: [], contradictions: [], checks: [], corrections: [], codeVerification: null, failures: [], safety: null, confidence: null, decision: null, geminiReview: null, redTeam: null, assumptions: [], counterexamples: [], answerConditions: [], contributions: [], disagreement: null, participation: null, reviewCheckpoint: null, agentLedger: initialAgentLedger(), verificationProfile: verificationProfile(task), finalAnswer: null,
    metadata: { appVersion: config.version, promptVersion: config.promptVersion, policyVersion: config.policyVersion, modelPoolMode: task.poolMode, verificationMode: task.verificationMode, demoFallback: !config.openRouterKey && !config.geminiKey && !config.openAiKey }
  };
}

module.exports = { SCENARIOS, VERIFICATION_PROFILES, AGENT_RESPONSIBILITIES, parseTask, planTask, rankModels, selectModels, verificationProfile, mapWithConcurrency, answeredResponses, responseParticipation, consolidateClaims, retrieveEvidence, verifyClaims, calculateRunConfidence, decide, createRun, executeRun, detectInjection, extractMath, extractCode, classify, redTeamAssessment, collectAssumptions, decisionConditions, counterexamplesFor, modelContributions, disagreementSummary, finalAnswer, boundedConclusion };
