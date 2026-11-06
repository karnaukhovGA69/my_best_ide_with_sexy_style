# chat-topology-count-telemetry-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-topology-count-telemetry-disable. База: 354801b3e948558ea0ed45a9ba1ce55576ea694c.

P02/A07: удалить startup/model creation/editor topology analytics. Область: src/vs/workbench/contrib/chat/browser/telemetry/chatModelCountTelemetry.ts, chatEditorTopologyTelemetry.ts и test/browser/telemetry/chatEditorTopologyTelemetry.test.ts относительно contrib/chat; этот отчёт. Shared entrypoints/GitHub authorization/history исключены. Helpers topology используются только тестом.

Код: `a57bd02803a`. Удалены registrations, listeners, scheduler, snapshot calculations и telemetry payloads. Compatibility classes без DI. Проверки: 2 browser tests passed; ESLint 3 files passed; targeted TypeScript 3 files 0 diagnostics; diff --check passed. Full package/typecheck интегратором, wiring не требуется.
