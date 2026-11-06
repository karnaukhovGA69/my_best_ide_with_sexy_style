# agent-debug-live-capture-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-debug-live-capture-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить runtime AgentHostChatDebugContribution (provider registration, file/session observers, usage/customization sidecar capture). Область: chat/browser/chatDebug/agentHostChatDebugProvider.ts — contribution и его orphan internals; chat/test/browser/agentHostChatDebugProvider.test.ts — заменить live-refresh suite на strict DI no-capture regression, сохранить parser/converter suites; этот отчёт. Сохранить pure conversion/parsing exports и данные существующих logs/sidecars. Shared entrypoints/auth/Git/обычный debugger не менять.
