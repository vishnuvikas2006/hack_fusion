# Deployment

1. Deploy the repository to a Node 20+ service with start command `node src/server.js`.
2. Add `OPENROUTER_API_KEY` and optional `OPENROUTER_SITE_URL`/`OPENROUTER_APP_NAME` in the platform secret manager. You may also add `GEMINI_API_KEY` and `OPENAI_API_KEY` for direct provider fallbacks. Do not place any of them in frontend variables or commit `.env`.
3. Configure `PORT` from the host, and set model/retry/timeout limits suitable for the account quota.
4. For actual generated-code execution, deploy a hardened isolated executor first and set `SANDBOX_ENABLED=true` only after it enforces no host credentials, no host filesystem access, no network, process/memory/CPU/time limits, and an allow-listed runtime.
5. Run `npm.cmd test` and `npm.cmd run lint`, then demonstrate the deterministic fallback and live-provider graceful degradation.
6. Record the public deployment URL and repository URL in `README.md` before submission.

The application starts in deterministic fallback if no OpenRouter secret is supplied, enabling a transparent, reproducible jury demonstration rather than a false live claim.
