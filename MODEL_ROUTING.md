# Model Routing

The desired initial pool contains NVIDIA, InclusionAI, Poolside, Dots Studio, Nexagi, Thinking Machine, Cohere, Qwen, Z.AI, Google, Gemma, and Deepgram. Their IDs, capabilities, priorities, and evaluation metrics are centralized in `src/config.js` and may be overridden through `MODEL_POOL_JSON`.

`Smart Pool` scores enabled available models using task capabilities, verification history, failure rate, and priority, up to `MODEL_COUNT`. It can add ranked backups up to `MAX_MODEL_CALLS` if the initial providers do not meet `MIN_SUCCESSFUL_MODELS`. `Full Pool` attempts every enabled available model. `Custom Pool` uses explicit user selections. Generation begins concurrently and each failure is normalized, retained, and isolated; enough healthy responses continue the run.

Optional direct adapters use `GEMINI_API_KEY`/`GEMINI_MODEL` and `OPENAI_API_KEY`/`OPENAI_MODEL`, and are preferred as high-diversity Smart Pool candidates when configured. OpenRouter Gemini, GPT, and Claude models remain separate optional candidates; paid OpenRouter calls require explicit `OPENROUTER_ALLOW_PAID_MODELS=true`.

For live OpenRouter operation the registry is refreshed from `/api/v1/models`; configured desired providers are matched to current free models. A model may be marked available, unavailable, disabled, rate-limited, timeout, or failed without failing the full run. The UI deliberately presents routing metrics as project-specific evaluation signals, never a universal model ranking.
