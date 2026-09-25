# Test Report

**Build:** 1.0.0  
**Environment:** Node 22 / deterministic demo fallback unless a server key is supplied  
**Date:** 2026-09-25  
**Total tests:** 23  
**Passed:** 23  
**Failed:** 0  
**Skipped:** 0  
**Pass rate:** 100%

## Automated coverage

The Node suite includes unit tests for input validation, classification, math grammar, injection detection, normalization, routing, claim consolidation, evidence/contradiction detection, consensus-without-evidence, confidence, decision gates, correction, demo scenarios, and integration tests for health, starting a streamed run, audit retrieval/export, and invalid requests.

Run:

```bash
npm.cmd test
npm.cmd run lint
```

## Current quality gates

- No API key is returned by public configuration or health endpoints.
- No empty task can start a run.
- Unsupported consensus does not become verified.
- Deterministic mismatches trigger a tracked re-verification path.
- Missing evidence, ambiguous requests, unsafe requests, and an unavailable code sandbox fail safely.

## Security and performance results

- Public health/configuration paths were checked not to expose an OpenRouter key.
- Empty/oversized-invalid input follows controlled errors; API payloads and document formats are bounded.
- Prompt-injection-like document content is detected and isolated as untrusted data.
- The deterministic five-model Smart Pool completes in roughly 0.5 seconds in local tests; a live model run is subject to provider latency and configured timeout.

## Known limits

The connected browser surface was unavailable in this environment, so an interactive visual pass must be rerun locally/deployed. Live OpenRouter availability and hardened container execution also require their corresponding target-runtime adapters.
