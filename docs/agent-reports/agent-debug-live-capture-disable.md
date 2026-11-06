# agent-debug-live-capture-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-debug-live-capture-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить runtime AgentHostChatDebugContribution (provider registration, file/session observers, usage/customization sidecar capture). Область: chat/browser/chatDebug/agentHostChatDebugProvider.ts — contribution и его orphan internals; chat/test/browser/agentHostChatDebugProvider.test.ts — заменить live-refresh suite на strict DI no-capture regression, сохранить parser/converter suites; этот отчёт. Сохранить pure conversion/parsing exports и данные существующих logs/sidecars. Shared entrypoints/auth/Git/обычный debugger не менять.

Удалены live provider/discovery registration, подписки и file watchers, usage/customization capture, live cache и приватные orphan helpers. Contribution ID сохранён как инертный. Pure parsing/conversion exports и их прежние suites сохранены. Код: 68bbcaec42f.

Проверки: 15 browser tests passed (прежние converters/parser и strict DI no-capture); ESLint — 2 файла; узкие TypeScript diagnostics — 2 файла, 0 ошибок; git diff --check. Первый запуск выявил пропущенный импорт test URI scheme: восстановлен, tests/types/lint повторно прошли. Исторические logs/sidecars не удалялись и не переписывались. Full build/package/native smoke не запускались.
