# chat-mode-telemetry-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-mode-telemetry-disable. База: 354801b3e948558ea0ed45a9ba1ce55576ea694c.

P02/A07: убрать сбор и отправку mode-switch analytics. Область: src/vs/workbench/contrib/chat/common/chatModeTelemetry.ts и test/common/chatModeTelemetry.test.ts относительно contrib/chat; этот отчёт. Сохранить сигнатуру reportChatModeChange. Общие modes/extension APIs/GitHub authorization/shared entrypoints исключены.

Код: `946b992b2c4`. Удалены metadata collection/classification/emission. Совместимая функция не читает modes/provider/tools. 1 browser test passed; ESLint 2 files passed; targeted TypeScript 2 files 0 diagnostics; diff --check passed. Full проверки интегратором; wiring не требуется.
