# mcp-platform-gateway-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-api-disable/documents-ui. Ветка: `agent/mcp-platform-gateway-disable`. База: `59f0fde52ec`.

Область зарезервирована до реализации: `src/vs/platform/mcp/node/mcpGatewayService.ts`, `src/vs/platform/mcp/node/mcpGatewayChannel.ts`, соответствующие `src/vs/platform/mcp/test/node/mcpGatewayService.test.ts` и `mcpGatewayChannel.test.ts`, этот отчёт. Не назначать второго владельца.

Задача A05: отключить платформенный MCP HTTP gateway и входящий IPC запуск без logger/listener/broker side effects; сохранить service/channel exports и contracts для main/remote consumers. Workbench gateway и broker contributions принадлежат другому агенту и не меняются. Общие entrypoints, contracts, session helpers, API, discovery/gallery/migration, Terminal/Tasks, Git/auth, voice и documents/PDF не менять. Полная сборка и релиз остаются интегратору.
