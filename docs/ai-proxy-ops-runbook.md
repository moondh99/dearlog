# AI Proxy Operations Runbook

Last checked: 2026-05-31

## Purpose

This runbook is for `ai_proxy_alert` notifications from the Dearlog local AI proxy. Alerts are created when recent `AiProxyAuditLog` entries cross the configured error, provider, configuration, or rate-limit thresholds.

## Alert Routing

Configure operator delivery with these environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROXY_ALERT_NOTIFICATIONS_ENABLED` | enabled outside production, disabled in production unless `true` | Turns operator alert routing on or off |
| `AI_PROXY_ALERT_NOTIFICATION_USER_IDS` | empty | Comma-separated guardian/operator user IDs that receive `ai_proxy_alert` notifications |
| `AI_PROXY_ALERT_NOTIFICATION_COOLDOWN_MINUTES` | `30` | Suppresses duplicate alerts of the same type per operator |
| `AI_PROXY_ALERT_WINDOW_MINUTES` | `60` | Audit-log window used when evaluating notifications |
| `AI_PROXY_ALERT_RUNBOOK_URL` | `/docs/ai-proxy-ops-runbook.md` | Link included in alert metadata |
| `AI_PROXY_ALERT_ERROR_RATE_PERCENT` | `25` | Error-rate threshold |
| `AI_PROXY_ALERT_RATE_LIMITED_COUNT` | `10` | Rate-limited request threshold |
| `AI_PROXY_ALERT_MIN_REQUESTS` | `5` | Minimum request count for error-rate alerts |

Production should explicitly set `AI_PROXY_ALERT_NOTIFICATIONS_ENABLED=true` and `AI_PROXY_ALERT_NOTIFICATION_USER_IDS` to real operator accounts. Keep `AI_PROXY_DASHBOARD_TOKEN` non-empty in production and share it only through the team secret store.

## Provider Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FACTCHAT_API_KEY` | empty | Mindlogic FactChat Gateway key for chat, photo analysis, and cover decisions |
| `FACTCHAT_BASE_URL` | `https://factchat-cloud.mindlogic.ai/v1/gateway` | OpenAI-compatible Gateway base URL |
| `FACTCHAT_CHAT_MODEL` | `gpt-5-mini` | Default chat model; verify availability with `GET /v1/gateway/models/` |
| `FACTCHAT_VISION_MODEL` | `FACTCHAT_CHAT_MODEL` | Optional model override for image-based photo analysis |
| `OPENAI_API_KEY` | empty | OpenAI key retained only for embeddings and realtime paths |

## Triage Steps

1. Open the guardian My Page `AI 운영 점검` panel or call `GET /api/ai/audit-summary`.
2. Check alert types:
   - `config_error`: verify `FACTCHAT_API_KEY` for chat/photo/cover requests, `OPENAI_API_KEY` for embeddings/realtime, model names, and server environment variables.
   - `provider_error`: check upstream Mindlogic FactChat Gateway/OpenAI status, provider status/code, and recent deploys.
   - `rate_limited`: check abusive loops, retry behavior, and per-user endpoint usage.
   - `error_rate`: inspect the recent errors list and compare with traffic volume.
3. Confirm whether the issue affects all endpoints or only `chat_completions` / `embeddings`.
4. Check the top `byUser` rows for a single user or automation consuming disproportionate requests.
5. Record the action taken in the incident notes for the release or demo.

## Immediate Mitigation

- For `config_error`, restore the missing secret/config and restart the API server.
- For upstream `provider_error`, confirm `FACTCHAT_BASE_URL`, `FACTCHAT_CHAT_MODEL`, and tenant model availability with `GET /v1/gateway/models/`; then switch to offline demo mode for presentations or pause AI-dependent actions.
- For `rate_limited`, reduce retry frequency, lower traffic from the offending user/session, or tune `AI_PROXY_RATE_LIMIT_PER_MINUTE` and `AI_PROXY_UNIT_LIMIT_PER_MINUTE` only after confirming legitimate demand.
- For repeated critical alerts, disable production AI proxy access temporarily at the edge or turn off affected UI entry points until the cause is isolated.

## Follow-Up

- Keep `AiProxyAuditLog` retention at the minimum operationally useful window.
- Review alert thresholds after real traffic is observed.
- Add external incident routing later if the deployment moves beyond the local/demo environment.
