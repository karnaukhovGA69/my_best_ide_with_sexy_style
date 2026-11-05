# mcp-registry-runtime-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-registry-runtime-remove`. База: main `b73001809cd` + готовая цепочка mcp-request-handler-runtime-delete. Необходимая зависимость: mcp-runtime-service-remove.

Зарезервированы src/vs/workbench/contrib/mcp/common/mcpRegistry.ts, test/common/mcpRegistry.test.ts, common/mcpService.ts (только уже осиротевший McpCollisionEnablementModel и его imports), этот отчёт. Удалить registry collection/delegate orchestration, lazy discovery, variable/storage/UI/trust/connection resolution. Сохранить IMcpRegistry singleton с пустыми results, no-op registrations, unavailable saved-input mutations без чтения/удаления secrets/settings. Tests заменить проверками inactive boundary; collision model больше не нужен после runtime service removal и удаления active-registry tests. Общие policy/trust/configuration/auth API и GitHub/Git/SSH не редактируются.
