# HACKFUSION Multi-Talented Agent

An evidence-first, multi-model reasoning and verification prototype for HackFusion 2026 Theme 8. It treats model responses as independent perspectives, not proof: important claims are normalized, linked to evidence, independently checked, challenged for contradictions, and either accepted with a visible decision record or limited/rejected.

## What is implemented

- Provider-agnostic model gateway with optional server-side OpenRouter, Gemini, and OpenAI credentials; dynamic model discovery, parallel calls, timeouts, partial-failure handling, and configurable pools.
- Clearly separated planning, generation, claim extraction, evidence, verifier, critic/safety, correction, decision, and finalizer stages.
- Deterministic arithmetic verification; evidence/contradiction checks; API-registry demonstration; code verification gate that fails safely when a hardened sandbox is absent.
- Prompt-injection pattern detection for uploaded text, input size/type validation, audit events, confidence scoring that is capped below certainty, exports, feedback, and evaluation metadata.
- A responsive light dashboard with Home, Model Lab, Analytics, Settings, execution streaming, claim/evidence graph, model responses, certificate, and eight reproducible demo scenarios.

## Quick start

```bash
copy .env.example .env
npm.cmd test
npm.cmd start
```

Open `http://localhost:3000`. Without an OpenRouter key the interface explicitly enters **Deterministic demo fallback**; simulated responses are never presented as live provider output. Set `OPENROUTER_API_KEY` only in `.env` or your deployment secret store to use live OpenRouter calls.

## Configuration

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-only unified gateway credential. Never sent to the browser. |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Optional direct Google Gemini credential and model. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Optional direct OpenAI API credential and model. This is an API-platform key, not a ChatGPT browser-session credential. |
| `MODEL_POOL_JSON` | Optional JSON model pool overriding the desired provider configuration. |
| `MODEL_COUNT` / `MAX_RETRIES` / `MAX_ROUNDS` | Cost, retry, and orchestration limits. |
| `MODEL_TIMEOUT_MS` | Per-provider request timeout. |
| `CONFIDENCE_THRESHOLD` / `EVIDENCE_THRESHOLD` | Decision-gate thresholds. |
| `SANDBOX_ENABLED` | Enables only when a hardened sandbox executor is available. |
| `ADMIN_TOKEN` | Required for the administrative status endpoint. |

See [.env.example](.env.example) for the complete list.

## Architecture and verification

Read [ARCHITECTURE.md](ARCHITECTURE.md), [AGENTS.md](AGENTS.md), [MODEL_ROUTING.md](MODEL_ROUTING.md), and [VERIFICATION_ENGINE.md](VERIFICATION_ENGINE.md). The policy deliberately rejects `model agreement = truth`; a run is only `VERIFIED` if evidence, independent checks, contradictions, safety, and claim coverage meet the configured gate.

## Demo flow

Choose a scenario on Home or submit a task:

1. Watch the execution workspace as independent responses arrive.
2. Open the final claim matrix, evidence cards, checks, and correction timeline.
3. Export the Markdown verification report or JSON audit log.

The most useful jury demonstration is **Conflicting Answers** followed by **Self-Correction**. [DEMO_GUIDE.md](DEMO_GUIDE.md) includes the exact walkthrough.

## Tests

```bash
npm.cmd test
npm.cmd run lint
```

The Node test suite covers input validation, routing, normalization, claim/evidence/contradiction processing, confidence/decision gates, correction loops, deterministic demo cases, streaming run creation, exports, and secret-safe health output. See [TEST_REPORT.md](TEST_REPORT.md) and [EVALUATION.md](EVALUATION.md).

## Deployment

The app has no runtime package dependencies and starts with `node src/server.js`. Configure secrets in the hosting platform; do not commit `.env`. See [DEPLOYMENT.md](DEPLOYMENT.md) for a production checklist. A public URL and repository URL need to be supplied by the team after deployment—none are invented here.

## Limitations

- Live OpenRouter availability and free model IDs change over time; dynamic discovery is used where a key is configured.
- General factual web retrieval is intentionally not fabricated. The prototype relies on supplied documents, its curated demo registry, deterministic tools, and live-model output; an approved search connector can be added via the evidence adapter.
- Arbitrary generated code is never run on the host. A `SANDBOX_ENABLED` deployment must provide a hardened isolated executor before code can be accepted as fully verified.

## Team

Add team/member names, the final public GitHub URL, deployment URL, and screenshots before submission.
