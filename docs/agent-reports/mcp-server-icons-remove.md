# mcp-server-icons-remove

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-server-icons-remove`. База: `62f2cc32a7c`.

Зарезервированы `src/vs/workbench/contrib/mcp/common/mcpIcons.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpIcons.test.ts` и этот отчёт. Удалить parsing/validation/selection/revival MCP-provided icons; facade возвращает пустой parsed list/undefined URL без чтения data/cache/launch/logger. Сохранить публичные data types для совместимости server metadata. Обычные theme/editor/extension icons, GitHub auth и связанные компоненты не менять. Целевые проверки, без build/release.
