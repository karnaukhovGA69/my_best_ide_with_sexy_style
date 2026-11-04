# mcp-copilot-config-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-devmode-disable и mcp-sampling-disable. Ветка: `agent/mcp-copilot-config-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpCopilotGlobalConfigurationService.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcpCopilotGlobalConfigurationService.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpCopilotGlobalConfigurationService.test.ts`, новый соответствующий тест в `test/electron-browser/`, этот отчёт. Не назначать второго владельца.

Задача A05: отключить разрешение Copilot Global MCP configuration через local/remote discovery, убрать IPC/таймаут/Agent Host dependencies в этой области и сохранить service exports с результатом unavailable. Не менять пользовательские файлы, platform discovery helpers/contracts, общие entrypoints/contributions, команды/UI, обычные remote/SSH services, другие области агентов, main/build/dependencies. Полная сборка и релиз — у интегратора.
