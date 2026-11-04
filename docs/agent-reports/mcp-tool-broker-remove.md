# mcp-tool-broker-remove

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-tool-broker-remove`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpGatewayToolBrokerChannel.test.ts` и этот отчёт. Не назначать второго владельца.

Задача A05: удалить реализацию gateway tool broker (MCP inventory/listeners, startup grace timers/cache, запуск серверов, tool/resource calls). Сохранить совместимый IPC endpoint: пустые списки, неактивные events, явный отказ исполнения/чтения и ошибки неизвестных операций. Не менять уже подготовленные gateway services/contributions других задач, общий IPC, MCP contracts, main/build/dependencies. Целевые тесты и IPC roundtrip; общая интеграция остаётся интегратору.
