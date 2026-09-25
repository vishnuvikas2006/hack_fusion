'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { config } = require('./config');

const BLOCKED_SYNTAX = [/\bchild_process\b/, /\bprocess\b/, /\brequire\s*\(\s*['"](?:fs|net|http|https|tls|dgram|cluster)['"]/, /\bfetch\s*\(/, /\bimport\s*\(/, /while\s*\(\s*true\s*\)/, /for\s*\(\s*;;\s*\)/];

function inspectCode(code, language) {
  if (language !== 'javascript') return { allowed: false, reason: 'Only JavaScript is supported by the configured isolated executor.' };
  if (!code || code.length > 50000) return { allowed: false, reason: 'Code is empty or exceeds the sandbox size limit.' };
  const blocked = BLOCKED_SYNTAX.find((pattern) => pattern.test(code));
  return blocked ? { allowed: false, reason: `Blocked by sandbox policy: ${blocked.source}` } : { allowed: true };
}

function execute(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: error.code === 'ENOENT' ? 'Docker is not available on this host.' : error.message, timedOut, unavailable: error.code === 'ENOENT' }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut, unavailable: false }); });
  });
}

function testRunner(code) {
  const exportsAdd = /module\.exports\s*=\s*\{[^}]*\badd\b|exports\.add\s*=/.test(code);
  if (!exportsAdd) return "require('/workspace/candidate.js'); console.log('EXECUTION_OK');";
  return "const candidate=require('/workspace/candidate.js'); const add=candidate.add; if(typeof add!=='function') throw new Error('Expected exported add function'); const cases=[[2,3,5],[0,0,0],[-3,5,2],[1000000,2,1000002]]; for(const [a,b,expected] of cases){if(add(a,b)!==expected)throw new Error('Test failed for '+a+','+b)} console.log('TESTS_PASSED');";
}

async function runIsolatedJavaScript(code) {
  const inspection = inspectCode(code, 'javascript');
  if (!inspection.allowed) return { status: 'blocked', detail: inspection.reason, tests: [] };
  if (!config.sandboxEnabled) return { status: 'unavailable', detail: 'Hardened sandbox execution is not configured.', tests: [] };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hackfusion-sandbox-'));
  try {
    await fs.writeFile(path.join(directory, 'candidate.js'), code, { encoding: 'utf8', mode: 0o600 });
    await fs.writeFile(path.join(directory, 'runner.js'), testRunner(code), { encoding: 'utf8', mode: 0o600 });
    const result = await execute('docker', [
      'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--pids-limit', '64', '--memory', '128m', '--cpus', '0.5', '--user', '1000:1000', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
      '--mount', `type=bind,source=${directory},destination=/workspace,readonly`, process.env.SANDBOX_IMAGE || 'node:22-alpine',
      'node', '/workspace/runner.js'
    ], 5000);
    if (result.unavailable) return { status: 'unavailable', detail: result.stderr, tests: [] };
    if (result.timedOut) return { status: 'failed', detail: 'Sandbox execution exceeded its time limit.', tests: ['timeout'] };
    if (result.code !== 0) return { status: 'failed', detail: result.stderr.slice(0, 500) || 'Sandboxed code exited with an error.', tests: ['execution'] };
    return { status: 'passed', detail: result.stdout.includes('TESTS_PASSED') ? 'Generated normal, zero, negative, and large-input tests passed.' : 'Isolated JavaScript execution completed.', tests: result.stdout.includes('TESTS_PASSED') ? ['normal', 'zero', 'negative', 'large input'] : ['execution'] };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

module.exports = { inspectCode, runIsolatedJavaScript };
