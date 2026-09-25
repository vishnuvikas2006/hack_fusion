# API Documentation

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Secret-safe health mode. |
| `GET` | `/api/config` | Public, masked-safe runtime configuration. |
| `GET` | `/api/models?refresh=true` | Provider registry, optionally refreshed. |
| `GET` | `/api/scenarios` | Reproducible demo scenarios. |
| `POST` | `/api/runs` | Starts a run; body contains `task`, `mode`, `poolMode`, `customModels`, `documents`, optional `scenario`. |
| `GET` | `/api/runs` / `/api/runs/:id` | Run index or full audit data. |
| `GET` | `/api/runs/:id/events` | Server-Sent execution updates. |
| `GET` | `/api/runs/:id/export?format=json|markdown|html` | Audit/report export. |
| `POST` | `/api/feedback` | Stores `runId`, `rating`, optional message. |
| `GET` | `/api/evaluation` / `/api/analytics` | Dataset/golden cases and aggregated metrics. |
| `GET` | `/api/admin/status` | Requires `Authorization: Bearer <ADMIN_TOKEN>`. |

Errors are JSON objects with a safe `error` message. Requests have a 1.5 MB payload limit; tasks and extracted text have stricter configurable limits.
