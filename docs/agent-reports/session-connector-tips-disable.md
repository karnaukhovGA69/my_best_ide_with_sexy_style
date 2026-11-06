# session-connector-tips-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/session-connector-tips-disable. База: fa5f110f488604b14c34fa332a38772c3caadf62.

A06/P02: отключить provider рекомендаций connectors по тексту chat input. Область: src/vs/sessions/contrib/chat/browser/newChatConnectorRecommendations.ts и src/vs/sessions/contrib/chat/test/browser/newChatConnectorRecommendations.test.ts, этот отчёт. Public provider methods/constructor static arguments сохранить; удалить input/config observation, recommendation selection, telemetry trigger. Общие MCP/marketplace/shared entrypoints/GitHub authorization исключены.
