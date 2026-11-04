# mcp-native-discovery-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-elicitation-disable и mcp-copilot-config-disable. Ветка: `agent/mcp-native-discovery-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/platform/mcp/node/nativeMcpDiscoveryHelperService.ts`, `src/vs/platform/mcp/test/node/nativeMcpDiscoveryHelperService.test.ts`, этот отчёт. Не назначать второго владельца.

Задача A05: отключить платформенный MCP discovery helper — чтение окружения/home directory, shell environment resolution и выдачу путей discovery через старый IPC. Сохранить constructor/export/service contract, явно отклонять load вместо фиктивных путей. Проверить callers. Общие environment/shell/SSH services, IPC contracts/registrations, discovery contributions другого агента, прочие области, main/build/dependencies не менять. Полная сборка и релиз — у интегратора.
