# mcp-sampling-log-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-native-discovery-disable и mcp-sampling-disable. Ветка: `agent/mcp-sampling-log-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpSamplingLog.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpSamplingLog.test.ts`, этот отчёт. Не назначать второго владельца.

Задачи A05/A07: отключить запись MCP sampling prompts/responses и request counters в storage, чтение/форматирование накопленных записей и storage listeners. Сохранить совместимость exports/callers; не удалять существующие пользовательские данные. Общий StorageService, sampling service ранее подготовленной ветки, MCP contracts/contributions, остальные области агентов, main/build/dependencies не менять. Полная сборка и релиз — у интегратора.
