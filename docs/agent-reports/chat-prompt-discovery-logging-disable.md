# chat-prompt-discovery-logging-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-prompt-discovery-logging-disable. База: be461ce28664e8257d083f6abebd2622bf9f1b8b.

P02/A07: удалить автоматический сбор prompt discovery/customization details в AI debug events. Область: src/vs/workbench/contrib/chat/browser/promptsDebugContribution.ts и test/browser/promptsDebugContribution.test.ts, этот отчёт. Удалить observers/extra discovery requests/resolvers/maps/forwarding; сохранить contribution ID. Реальную prompt discovery, общие логи, пользовательскую историю/GitHub authorization/shared entrypoints не менять.

Код: `5d3eb214c4e`. Удалены agent/session listeners, extra prompt discovery requests, path/hook/customization aggregation, event forwarding/resolvers и retained maps. Contribution ID сохранён без DI. Реальная discovery и общие диагностические логи вне scope.

Проверки: 1 browser test strict empty DI; ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Full typecheck/build/package — интегратор. Подключений нет.
