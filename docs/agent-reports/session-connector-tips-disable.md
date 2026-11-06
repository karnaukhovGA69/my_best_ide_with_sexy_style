# session-connector-tips-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/session-connector-tips-disable. База: fa5f110f488604b14c34fa332a38772c3caadf62.

A06/P02: отключить provider рекомендаций connectors по тексту chat input. Область: src/vs/sessions/contrib/chat/browser/newChatConnectorRecommendations.ts и src/vs/sessions/contrib/chat/test/browser/newChatConnectorRecommendations.test.ts, этот отчёт. Public provider methods/constructor static arguments сохранить; удалить input/config observation, recommendation selection, telemetry trigger. Общие MCP/marketplace/shared entrypoints/GitHub authorization исключены.

Код: `343921a6314`. Удалены recommendation selection/URLs, input/config listeners, experiment telemetry и provider registration. Методы инертны, Event.None, constructor static args сохранены; DI dependencies отсутствуют.

Проверки: 1 browser regression test (strict empty DI + throwing input/subscription/random, empty provider results/0 events) passed; ESLint 2 files passed; targeted TypeScript 2 files 0 diagnostics; git diff --check passed. Shared matching helper пока используется другими callers и не удаляется. Full package/typecheck интегратором, wiring не требуется.
