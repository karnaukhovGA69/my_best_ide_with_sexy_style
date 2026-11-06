# chat-agent-recommendations-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-agent-recommendations-disable. База: 9be3b2c89dcbbb932398794f2f8d18a022fb398f.

P02/A06: удалить рекомендации AI plugins/agents и их background checks/install actions. Область: src/vs/workbench/contrib/chat/browser/claudePluginRecommendations.ts; browser/actions/chatAgentRecommendationActions.ts; common/connectorRecommendations.ts (удалить только если orphan); test/browser/chatAgentRecommendations.test.ts (новый); этот отчёт. Общие extension APIs/ручной VSIX/shared entrypoints/GitHub authorization не менять.

Код: `5bc6d3de37d`. Удалены plugin recommendation scan/fetch/notifications и agent recommendation install actions/listeners/activation timers. Оставлены совместимые contribution IDs без DI/работы. Удалён orphan connectorRecommendations helper (reference scan src/test/build перед удалением находил только определение, после — 0). Общая ручная установка расширений не затронута.

Проверки: 1 browser regression test; ESLint 3 файлов; selected-file semantic types 3 файлов (0 diagnostics); git diff --check — passed. Общие проверки/build/package — интегратор. Дополнительных подключений нет.
