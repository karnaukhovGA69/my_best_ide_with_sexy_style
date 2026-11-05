# mcp-runtime-service-remove

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-runtime-service-remove`. База: `98aa2b043b1`.

Зарезервированы `src/vs/workbench/contrib/mcp/common/mcpService.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpService.test.ts` и этот отчёт. Удалить orchestration: server assembly/discovery activation/autostart/timers/config/storage/profile dependencies. Сохранить IMcpService facade с пустыми observables и запрещённым enablement. McpCollisionEnablementModel оставить как отдельный existing helper, используемый registry tests. Tests прежних активных service/server policy scenarios заменить проверками полного отсутствия server creation и side effects через этот service. McpServer/registry/authentication implementations и Git/SSH/auth API, shared entrypoints, другие активные области не менять. Целевые проверки без build/release.
