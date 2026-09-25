# Agent Contracts

| Agent | Input | Output / boundary |
| --- | --- | --- |
| Planner | Sanitized task | Task categories, subtasks, evidence needs, verification plan. |
| Router | Plan and model registry | Diverse, task-capable model pool. |
| Reasoning agents | Original task independently | Normalized answer, atomic claims, assumptions, uncertainty. They do not receive peer responses initially. |
| Research/evidence | Claims and untrusted documents | Provenanced evidence links only; retrieved text remains data, never instructions. |
| Verifier | Claims + evidence + deterministic results | Per-claim state and explicit check results. |
| Critic | Consolidated claims | Contradiction/unsupported-claim findings. |
| Safety | Task and document findings | Risk state and any blocked action. |
| Correction | Failed claim/check | Bounded correction attempt followed by re-verification. |
| Finalizer | Verified/limited claims only | Concise conclusion, evidence references, limitations, status. |

Agent data contracts are structured JavaScript objects in `src/pipeline.js`. Generators do not determine their own final verification state.
