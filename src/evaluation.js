'use strict';

const { SCENARIOS } = require('./pipeline');

const GOLDEN_CASES = [
  ['GOLD-001', 'self-correction', 'A deterministic math mismatch is corrected and re-verified.'],
  ['GOLD-002', 'hallucination', 'Unsupported fictional API claims never become verified.'],
  ['GOLD-003', 'conflict', 'Trusted evidence resolves the Redis contradiction.'],
  ['GOLD-004', 'coding', 'Code cannot be fully verified without a hardened sandbox.'],
  ['GOLD-005', 'ambiguous', 'Missing criteria result in a clarification-oriented decision.'],
  ['GOLD-006', 'insufficient', 'No-evidence predictions are not fabricated.'],
  ['GOLD-007', 'api', 'Invalid API use is exposed as unverified.']
];

function evaluationDataset() {
  return SCENARIOS.map((scenario, index) => ({
    testId: `EVAL-${String(index + 1).padStart(3, '0')}`, scenario: scenario.id, input: scenario.task,
    category: scenario.tab, expectedBehavior: scenario.description,
    expectedState: ['simple', 'self-correction'].includes(scenario.id) ? 'VERIFIED' : scenario.id === 'coding' ? 'VERIFIED WITH LIMITATIONS' : 'NEEDS MORE EVIDENCE',
    datasetVersion: '2026-01'
  }));
}

function analytics(runs) {
  const complete = runs.filter((run) => run.status === 'complete');
  const claims = complete.flatMap((run) => run.claims);
  const modelResponses = complete.flatMap((run) => run.responses);
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  return {
    tasksVerified: complete.filter((run) => run.decision?.status === 'verified').length,
    tasksLimited: complete.filter((run) => run.decision?.status === 'verified-with-limitations').length,
    tasksNeedsEvidence: complete.filter((run) => run.decision?.status === 'needs-more-evidence').length,
    claimsChecked: claims.length,
    hallucinationsDetected: claims.filter((claim) => claim.status === 'rejected').length,
    unsupportedClaims: claims.filter((claim) => claim.status === 'unsupported').length,
    contradictionsDetected: complete.reduce((sum, run) => sum + run.contradictions.length, 0),
    correctionsPerformed: complete.reduce((sum, run) => sum + run.corrections.length, 0),
    averageVerificationQuality: average(complete.map((run) => run.confidence?.verificationQuality || 0)),
    averageGenerationLatency: average(modelResponses.filter((response) => response.status === 'success').map((response) => response.latencyMs)),
    failureRate: modelResponses.length ? Math.round(modelResponses.filter((response) => response.status === 'failed').length / modelResponses.length * 100) : 0
  };
}

module.exports = { GOLDEN_CASES, evaluationDataset, analytics };
