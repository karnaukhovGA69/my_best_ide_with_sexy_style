# mcp-orphan-connection-tasks-delete

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-connection-tasks-delete`. База main `411cccde06e` + готовая цепочка mcp-registry-runtime-remove. Для следующего пакета после frozen release-0.0.9.

Зарезервированы src/vs/workbench/contrib/mcp/common/{mcpServerConnection,mcpTaskManager,mcpRegistryTypes}.ts, test/common/{mcpServerConnection.test,mcpTaskManager.test,mcpRegistryTypes}.ts и этот отчёт. Удалить orphan connection/task facades и неиспользуемые test transport/registry fixtures. В production mcpRegistryTypes убрать только taskManager import/property из неиспользуемых connection options; прочие contracts сохраняются. Обязательные dependencies: mcp-registry-runtime-remove и mcp-request-handler-runtime-delete. Обычные workbench Tasks, auth/GitHub/Git/SSH и чужие области не трогать.
