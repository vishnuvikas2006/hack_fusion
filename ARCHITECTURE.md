# Architecture

```text
Browser UI
  └─ HTTP API + Server-Sent Events
       ├─ Task Parser / Planner
       ├─ Model Router ── Provider-agnostic Gateway ── OpenRouter (optional)
       ├─ Claim Processor ── Evidence Engine ── Curated / supplied evidence
       ├─ Independent Verification ── Math / API / logic / safety gates
       ├─ Correction Router ── Re-verification
       └─ Decision + Finalizer ── Immutable in-memory audit record / exports
```

The browser never has the OpenRouter key. `src/modelGateway.js` is the sole OpenRouter adapter; `src/pipeline.js` owns the provider-independent orchestration and verification contracts. When no key is configured, `DemoGateway` emits explicitly labelled deterministic scenario responses, preserving the same audit schema for a reliable jury fallback.

Completed runs retain input, plan, models, normalized responses, claims, evidence, checks, failures, corrections, decision, final response, timestamps, prompt/policy versions, and demo/live provenance. The store intentionally never mutates historic model output to hide errors.
