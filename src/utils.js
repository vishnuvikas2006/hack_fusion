'use strict';

const crypto = require('node:crypto');

const now = () => new Date().toISOString();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeJsonParse(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function stripControlCharacters(value) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function redactSecrets(value) {
  return String(value || '')
    .replace(/(sk-or-v1-)[A-Za-z0-9_-]+/g, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/(OPENROUTER_API_KEY\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

module.exports = { now, sleep, id, clamp, safeJsonParse, stripControlCharacters, escapeHtml, redactSecrets };
