# mcp-install-wizards-remove

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-install-wizards-remove`. База: `98aa2b043b1`.

Зарезервированы `src/vs/workbench/contrib/mcp/browser/mcpCommandsAddConfiguration.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpCommandsAddConfiguration.test.ts` и этот отчёт. Удалить manual/model-assisted MCP installation wizard и manifest file installer, включая command/telemetry/file/install/server startup side effects. Сохранить два класса с run-отказом и минимальные enum/config-key exports для chat.shared.contribution. Общие commands/contribution/destination и authentication API, Git/SSH, другие активные области не менять. Целевые проверки, без сборки.

Дополнительный резерв до правок: `src/vs/workbench/contrib/mcp/test/browser/mcpConfigurationEntryPoints.test.ts`. В нём есть непрямые tests AddConfigurationAction → удаляемый wizard. Заменить только устаревшие wizard tests на отказ без side effects; destination/open configuration/install action tests других компонентов сохранить.

Расширение резерва до удаления: `src/vs/workbench/contrib/mcp/common/mcpConfigurationGeneration.ts` и `src/vs/workbench/contrib/mcp/test/common/mcpConfigurationGeneration.test.ts`. После удаления wizard у workbench generator нет production consumers. Одноимённый module внутри extensions/copilot — отдельный файл и этой задачей не затрагивается.
