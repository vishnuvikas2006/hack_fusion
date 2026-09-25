# Evaluation

The in-app evaluation endpoint exposes a versioned synthetic dataset and golden cases. It covers math verification, hallucination traps, conflicting claims, ambiguous questions, insufficient evidence, API verification, coding limits, misleading documents, and self-correction.

The dashboard tracks generation-related response latency/failure independently from verification metrics such as checked claims, unsupported/rejected claims, contradictions, corrections, and verification quality. For each run the metadata records app, prompt, policy, pool, and fallback versions to support replay and failure analysis.

To extend this into a full benchmark, add cases with `testId`, input, category, expected decision, evidence, ground truth, and dataset version; do not use production secrets or private documents in test data.
