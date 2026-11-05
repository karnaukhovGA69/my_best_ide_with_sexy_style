# mcp-plugin-discovery-delete

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-plugin-discovery-delete`. База: актуальный main `b73001809cd`.

Зарезервированы src/vs/workbench/contrib/mcp/common/discovery/{pluginMcpDiscovery,mcpDiscovery}.ts, test/common/pluginMcpDiscovery.test.ts, test/browser/mcpDiscovery.test.ts, test/electron-browser/mcpDiscoveryRegistration.test.ts (test paths относительно contrib/mcp), src/vs/workbench/contrib/chat/browser/aiCustomization/mcpListWidget.ts (только перенаправление import константы) и этот отчёт. Удалить orphan plugin discovery/runtime registry и соответствующие obsolete tests, сохранить singleton registration assertions. Константу MCP_PLUGIN_COLLECTION_ID_PREFIX импортировать напрямую из существующего mcpTypes, где она определена. Другие части chat UI, GitHub/auth/Git/SSH и чужие области не менять.
