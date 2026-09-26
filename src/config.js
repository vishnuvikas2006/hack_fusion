'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Production deployments inject environment variables directly. This small loader
// supports local development without adding a dependency and never reads .env.example.
const LOCAL_ENV_PATH = path.resolve(__dirname, '..', '.env');
const PROVIDER_ENV_KEYS = new Set(['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_COMPLEX_THINKING_LEVEL', 'GEMINI_DEEP_THINKING_LEVEL', 'GEMINI_MAX_OUTPUT_TOKENS', 'GEMINI_COMPLEX_MAX_OUTPUT_TOKENS', 'GEMINI_REVIEW_MAX_OUTPUT_TOKENS', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENROUTER_ALLOW_PAID_MODELS']);

function loadLocalEnvironment() {
  const envPath = LOCAL_ENV_PATH;
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

loadLocalEnvironment();

const parseInteger = (name, fallback, min, max) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
};

const parseNumber = (name, fallback, min, max) => {
  const value = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
};

const parseEnum = (name, fallback, allowed) => allowed.includes(String(process.env[name] || '').toLowerCase()) ? String(process.env[name]).toLowerCase() : fallback;

const DEFAULT_POOL = [
  ['NVIDIA', 'nvidia/llama-3.3-nemotron-super-49b-v1:free', ['reasoning', 'math', 'coding'], ['nvidia/']],
  ['InclusionAI', 'inclusionai/ling-1t:free', ['reasoning', 'research'], ['inclusionai/']],
  ['Poolside', 'poolside/point:free', ['coding', 'reasoning'], ['poolside/']],
  ['Dots Studio', 'dots-studio/kat-coder-pro:free', ['coding', 'math'], ['dots-studio/']],
  ['Nexagi', 'nex-agi/deepseek-v3.1-nex-n1:free', ['reasoning', 'research'], ['nex-agi/']],
  ['Thinking Machine', 'tngtech/deepseek-r1t2-chimera:free', ['reasoning', 'math'], ['tngtech/']],
  ['Cohere', 'cohere/command-r7b-12-2024:free', ['research', 'reasoning'], ['cohere/']],
  ['Qwen', 'qwen/qwen3-coder:free', ['coding', 'math', 'reasoning'], ['qwen/']],
  ['Z.AI', 'z-ai/glm-4.5-air:free', ['reasoning', 'coding'], ['z-ai/']],
  ['Google Gemini', 'google/gemini-2.5-flash', ['research', 'reasoning', 'coding', 'math', 'document', 'vision'], ['google/gemini-']],
  ['Gemma', 'google/gemma-3-12b-it:free', ['general', 'document'], ['google/gemma-']],
  ['OpenAI GPT', 'openai/gpt-4.1-mini', ['reasoning', 'coding', 'research', 'vision'], ['openai/gpt-']],
  ['Anthropic Claude', 'anthropic/claude-3.7-sonnet', ['reasoning', 'coding', 'research', 'vision'], ['anthropic/claude-']],
  ['Deepgram', 'deepgram/flux:free', ['general', 'research'], ['deepgram/']]
].map(([provider, modelId, capabilities, discoveryPrefixes], index) => ({
  provider,
  modelId,
  discoveryPrefixes,
  enabled: true,
  priority: index + 1,
  capabilities,
  metrics: { accuracy: 0.82 - (index % 4) * 0.02, verificationScore: 0.86 - (index % 3) * 0.02, latencyMs: 1200 + index * 95, failureRate: 0.03 + (index % 5) * 0.01 }
}));

function configuredPool() {
  if (!process.env.MODEL_POOL_JSON) return DEFAULT_POOL;
  try {
    const parsed = JSON.parse(process.env.MODEL_POOL_JSON);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Model pool must be a non-empty array');
    return parsed.map((model, index) => ({
      provider: String(model.provider || `Provider ${index + 1}`),
      modelId: String(model.modelId || model.id || ''),
      discoveryPrefixes: Array.isArray(model.discoveryPrefixes) ? model.discoveryPrefixes.map(String) : [String(model.modelId || model.id || '').split(':')[0]],
      enabled: model.enabled !== false,
      priority: Number.isFinite(model.priority) ? model.priority : index + 1,
      capabilities: Array.isArray(model.capabilities) ? model.capabilities.map(String) : ['general'],
      metrics: { accuracy: 0.75, verificationScore: 0.75, latencyMs: 1800, failureRate: 0.08, ...(model.metrics || {}) }
    }));
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'invalid_model_pool_config', message: error.message }));
    return DEFAULT_POOL;
  }
}

const config = {
  port: parseInteger('PORT', 3000, 1, 65535),
  demoMode: process.env.DEMO_MODE !== 'false',
  openRouterKey: process.env.OPENROUTER_API_KEY || '',
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || '',
  openRouterAppName: process.env.OPENROUTER_APP_NAME || 'HackFusion Multi-Talented Agent',
  openRouterAllowPaidModels: process.env.OPENROUTER_ALLOW_PAID_MODELS === 'true',
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  // Gemini 3.8 Flash defaults to medium thinking. Keep that efficient default
  // for complex coding and reserve high reasoning for Deep/Maximum runs.
  geminiComplexThinkingLevel: parseEnum('GEMINI_COMPLEX_THINKING_LEVEL', 'medium', ['low', 'medium', 'high']),
  geminiDeepThinkingLevel: parseEnum('GEMINI_DEEP_THINKING_LEVEL', 'high', ['low', 'medium', 'high']),
  geminiMaxOutputTokens: parseInteger('GEMINI_MAX_OUTPUT_TOKENS', 2048, 256, 64000),
  geminiComplexMaxOutputTokens: parseInteger('GEMINI_COMPLEX_MAX_OUTPUT_TOKENS', 8192, 512, 64000),
  geminiReviewMaxOutputTokens: parseInteger('GEMINI_REVIEW_MAX_OUTPUT_TOKENS', 4096, 512, 64000),
  openAiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  modelOutputTokens: parseInteger('MODEL_OUTPUT_TOKENS', 1600, 256, 32000),
  complexModelOutputTokens: parseInteger('COMPLEX_MODEL_OUTPUT_TOKENS', 4096, 512, 32000),
  finalAnswerMaxChars: parseInteger('FINAL_ANSWER_MAX_CHARS', 6000, 1000, 100000),
  complexFinalAnswerMaxChars: parseInteger('COMPLEX_FINAL_ANSWER_MAX_CHARS', 20000, 2000, 100000),
  modelCount: parseInteger('MODEL_COUNT', 5, 1, 12),
  maxModelCalls: parseInteger('MAX_MODEL_CALLS', 8, 1, 15),
  minSuccessfulModels: parseInteger('MIN_SUCCESSFUL_MODELS', 3, 1, 8),
  modelConcurrency: parseInteger('MAX_CONCURRENT_MODEL_CALLS', 2, 1, 4),
  maxRetries: parseInteger('MAX_RETRIES', 2, 0, 5),
  // Kept separate from provider retries so verification correction remains a
  // clearly bounded policy decision. MAX_RETRIES remains the legacy fallback.
  maxCorrectionLoops: parseInteger('MAX_CORRECTION_LOOPS', parseInteger('MAX_RETRIES', 2, 0, 5), 0, 5),
  maxRounds: parseInteger('MAX_ROUNDS', 5, 1, 8),
  modelTimeoutMs: parseInteger('MODEL_TIMEOUT_MS', 45000, 1000, 120000),
  maxInputChars: parseInteger('MAX_INPUT_CHARS', 16000, 100, 100000),
  maxDocumentChars: parseInteger('MAX_DOCUMENT_CHARS', 30000, 100, 250000),
  maxFileBytes: parseInteger('MAX_FILE_BYTES', 1048576, 1024, 10485760),
  confidenceThreshold: parseNumber('CONFIDENCE_THRESHOLD', 0.80, 0.1, 0.99),
  evidenceThreshold: parseNumber('EVIDENCE_THRESHOLD', 0.70, 0.1, 1),
  contradictionThreshold: parseNumber('CONTRADICTION_THRESHOLD', 0.35, 0, 1),
  adaptiveDisagreementThreshold: parseNumber('ADAPTIVE_DISAGREEMENT_THRESHOLD', 0.35, 0.05, 0.95),
  sandboxEnabled: process.env.SANDBOX_ENABLED === 'true',
  sandboxImage: process.env.SANDBOX_IMAGE || 'node:22-alpine',
  adminToken: process.env.ADMIN_TOKEN || '',
  version: '1.0.0',
  promptVersion: '2026-01-evidence-first',
  policyVersion: '2026-01-safe-verification',
  modelPool: configuredPool()
};

function safeEnvValue(value) {
  const normalized = String(value ?? '').replace(/[\r\n\0]/g, '').trim();
  return JSON.stringify(normalized);
}

function validateModelName(value, label) {
  const model = String(value ?? '').trim();
  if (!model || model.length > 160 || !/^[A-Za-z0-9._:/-]+$/.test(model)) throw new Error(`${label} contains unsupported characters.`);
  return model;
}

function validateKey(value, label) {
  const key = String(value ?? '').replace(/[\r\n\0]/g, '').trim();
  if (!key || key.length > 1000) throw new Error(`${label} is not valid.`);
  return key;
}

function writeLocalEnvironment(updates) {
  const current = fs.existsSync(LOCAL_ENV_PATH) ? fs.readFileSync(LOCAL_ENV_PATH, 'utf8') : '';
  const lines = current.replace(/^\uFEFF/, '').split(/\r?\n/);
  const remaining = new Set(Object.keys(updates));
  const next = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !remaining.has(match[1])) return line;
    remaining.delete(match[1]);
    return `${match[1]}=${safeEnvValue(updates[match[1]])}`;
  });
  for (const key of remaining) next.push(`${key}=${safeEnvValue(updates[key])}`);
  fs.writeFileSync(LOCAL_ENV_PATH, `${next.filter((line, index, all) => line || index < all.length - 1).join('\n').replace(/\n*$/, '\n')}`, { mode: 0o600 });
}

// This is intentionally limited to provider configuration. The server route that
// calls it is loopback-only unless an administrator token is supplied, and the
// public configuration endpoint never includes a key value.
function updateProviderSettings(input = {}) {
  const updates = {};
  if (Object.hasOwn(input, 'openRouterApiKey') && String(input.openRouterApiKey || '').trim()) {
    const value = validateKey(input.openRouterApiKey, 'OpenRouter API key');
    config.openRouterKey = value; process.env.OPENROUTER_API_KEY = value; updates.OPENROUTER_API_KEY = value;
  }
  if (Object.hasOwn(input, 'geminiApiKey') && String(input.geminiApiKey || '').trim()) {
    const value = validateKey(input.geminiApiKey, 'Gemini API key');
    config.geminiKey = value; process.env.GEMINI_API_KEY = value; updates.GEMINI_API_KEY = value;
  }
  if (Object.hasOwn(input, 'openAiApiKey') && String(input.openAiApiKey || '').trim()) {
    const value = validateKey(input.openAiApiKey, 'OpenAI API key');
    config.openAiKey = value; process.env.OPENAI_API_KEY = value; updates.OPENAI_API_KEY = value;
  }
  if (Object.hasOwn(input, 'geminiModel')) {
    const value = validateModelName(input.geminiModel, 'Gemini model');
    config.geminiModel = value; process.env.GEMINI_MODEL = value; updates.GEMINI_MODEL = value;
  }
  if (Object.hasOwn(input, 'openAiModel')) {
    const value = validateModelName(input.openAiModel, 'OpenAI model');
    config.openAiModel = value; process.env.OPENAI_MODEL = value; updates.OPENAI_MODEL = value;
  }
  if (typeof input.openRouterAllowPaidModels === 'boolean') {
    config.openRouterAllowPaidModels = input.openRouterAllowPaidModels;
    process.env.OPENROUTER_ALLOW_PAID_MODELS = String(input.openRouterAllowPaidModels);
    updates.OPENROUTER_ALLOW_PAID_MODELS = String(input.openRouterAllowPaidModels);
  }
  if (Object.keys(updates).length) writeLocalEnvironment(updates);
  return publicConfig();
}

function publicConfig() {
  return {
    demoMode: config.demoMode && !config.openRouterKey && !config.geminiKey && !config.openAiKey,
    openRouterConfigured: Boolean(config.openRouterKey),
    geminiConfigured: Boolean(config.geminiKey),
    openAiConfigured: Boolean(config.openAiKey),
    sandboxAvailable: config.sandboxEnabled,
    limits: {
      modelCount: config.modelCount,
      maxModelCalls: config.maxModelCalls,
      minSuccessfulModels: config.minSuccessfulModels,
      modelConcurrency: config.modelConcurrency,
      maxRetries: config.maxRetries,
      maxRounds: config.maxRounds,
      timeoutMs: config.modelTimeoutMs,
      maxInputChars: config.maxInputChars,
      maxFileBytes: config.maxFileBytes
    },
    version: config.version,
    policyVersion: config.policyVersion,
    paidModelsEnabled: config.openRouterAllowPaidModels,
    directProviders: {
      gemini: {
        configured: Boolean(config.geminiKey), model: config.geminiModel,
        complexThinkingLevel: config.geminiComplexThinkingLevel,
        deepThinkingLevel: config.geminiDeepThinkingLevel
      },
      openai: { configured: Boolean(config.openAiKey), model: config.openAiModel }
    }
  };
}

module.exports = { config, publicConfig, updateProviderSettings, DEFAULT_POOL, PROVIDER_ENV_KEYS };
