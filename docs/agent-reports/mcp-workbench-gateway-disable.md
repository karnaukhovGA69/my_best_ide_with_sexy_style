# mcp-workbench-gateway-disable

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit/gallery/discovery/migration. Ветка: `agent/mcp-workbench-gateway-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpGatewayService.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcpGatewayService.ts`, `src/vs/workbench/contrib/mcp/browser/mcpGatewayToolBrokerContribution.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcpGatewayToolBrokerContribution.ts`, новые `test/browser/mcpGatewayDisabled.test.ts` и `test/electron-browser/mcpGatewayDisabled.test.ts` внутри той же MCP-области, этот отчёт. Не назначать второго владельца.

Задача: отключить создание local/remote MCP gateways из workbench и регистрацию broker channels на старте, сохранив совместимые экспорты и явный отказ createGateway. Не менять platform MCP gateway/server, common contracts, extension API, contribution-файлы прежней discovery-ветки, main, общие entrypoints, зависимости, build, Terminal/Tasks и области других агентов. Полная сборка/интеграция остаётся интегратору.
