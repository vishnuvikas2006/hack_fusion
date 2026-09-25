# Verification Engine

1. Normalize provider output to a common response contract.
2. Split answers into atomic claims and retain contributing model IDs.
3. Retrieve provenance-bearing evidence from supplied text, curated trusted registry, and deterministic tool output.
4. Check claim-to-evidence support and contradictions. A claim with no sufficient evidence is `UNSUPPORTED`; trusted contradictory evidence produces `REJECTED`.
5. Prefer deterministic verification where possible. Arithmetic uses a restricted numeric grammar and a server-side calculator. API demo claims check a registry. When enabled, JavaScript code is placed in a temporary read-only Docker mount and run with no network, no capabilities, no host credentials, CPU/memory/PID/time limits, and no shell interpolation; otherwise code remains not fully verified.
6. Apply safety and prompt-injection gates. Untrusted document content never changes system instructions.
7. Route deterministic failures to a bounded correction loop, then re-verify the correction.
8. Calculate claim/run confidence from evidence coverage, independent checks, agreement, and contradiction penalties. Agreement cannot alone produce `VERIFIED`.
9. Decide `VERIFIED`, `VERIFIED WITH LIMITATIONS`, `NEEDS MORE EVIDENCE`, `REJECTED`, or `FAILED`, then synthesize only the accepted/limited result.

Quality gate: evidence coverage must meet the configured threshold, required checks must pass, no blocking safety risk may exist, and no unresolved critical conflict may remain. If verification is unavailable, the engine fails safe rather than emitting a verified label.
