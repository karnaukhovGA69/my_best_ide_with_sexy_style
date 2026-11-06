# local-model-ready-offer-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/local-model-ready-offer-disable. База: 8ddb6cc01c59dcd4a86ae5d3791bbf92adc700a9.

P02/A06: удалить local AI model ready offers, runtime observers, ready-offer commands, их analytics и orphan helpers/constants после consumer scan. Область: src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/localModelReadyNotification.ts и test/browser/agentSessions/localModelReadyNotification.test.ts, этот отчёт. Сохранить contribution и registration function как inert compatibility; не менять model install/removal service, user files/history/GitHub authorization/shared entrypoints.

Код: `cd94bbcaab0`. Удалены ready offers/actions/commands, observers, storage tracking, analytics и orphan helpers/constants (reference scan после — 0). Оставлены только совместимый inert contribution и registration function; никакие model files не удаляются.

Проверки: 1 browser test (strict DI, repeated registration, отсутствие 3 commands); ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Общая сборка/typecheck/package — интегратор. Подключений нет.
