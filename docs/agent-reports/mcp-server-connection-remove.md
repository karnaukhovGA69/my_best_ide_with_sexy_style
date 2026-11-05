# mcp-server-connection-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-server-connection-remove`. База: актуальный main `b73001809cd` + готовая зависимость `agent/mcp-runtime-service-remove` (код `7ce9e5ee9d3`, отчёт `7ef1eecb9a2`).

Зарезервированы `src/vs/workbench/contrib/mcp/common/mcpServerConnection.ts`, соответствующий `test/common/mcpServerConnection.test.ts` и этот отчёт. Удалить delegate start, transport/handshake subscriptions, sandbox log parsing, ожидания состояний; сохранить минимальный unavailable contract для registry/server consumers. Область свободна. Общие host delegates, auth/GitHub/Git/SSH не менять. Интеграция после mcp-runtime-service-remove: старые tests runtime service на main ещё ожидают настоящий запуск соединений.
