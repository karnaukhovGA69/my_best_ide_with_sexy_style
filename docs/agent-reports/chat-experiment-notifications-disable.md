# chat-experiment-notifications-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-experiment-notifications-disable. База: a7439ec8fd888ca9c5862227eb9b634e5c17815d.

P02/A06: удалить remotely configured experiment notifications. Область: src/vs/workbench/contrib/chat/browser/expNotification/chatExpNotificationContribution.ts; browser/expNotification/chatExpNotificationConfig.ts; test/browser/expNotification/chatExpNotification.test.ts; этот отчёт. Удалить parser после consumer scan; общий assignment/notification API, user storage/GitHub authorization/shared entrypoints исключены.

Код: `0c2beb91153`. Удалены assignment fetch/listeners, targeting, notifications и orphan payload parser/types. После удаления module/symbol reference scan src/test/build — 0. Contribution ID сохранён без DI; user storage не изменяется.

Проверки: 1 browser test; ESLint 2 файлов; selected-file semantic types 2 файлов (0 diagnostics); git diff --check — passed. Полная проверка/build/package — интегратор. Дополнительные подключения не нужны.
