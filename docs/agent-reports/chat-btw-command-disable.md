# chat-btw-command-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-btw-command-disable. База: 5407307c532ea63b4a5cfe3904338259fd6318c2.

P02: удалить встроенную /btw AI side-chat command. Область: src/vs/workbench/contrib/chat/browser/btwSlashCommand.ts и test/browser/btwSlashCommand.test.ts, этот отчёт. Удалить registration/selection capture/submission/analytics; сохранить contribution ID. Общий slash-command API/историю/GitHub authorization/shared entrypoints не менять.

Код: `0caa43b0f74`. Удалены /btw registration, selection/context capture, side-chat request, notifications и analytics; contribution ID сохранён, DI отсутствует. История не изменяется.

Проверки: 1 browser test strict empty DI; ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Полная сборка/typecheck/package — интегратор, подключений нет.
