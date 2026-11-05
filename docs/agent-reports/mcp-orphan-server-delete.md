# mcp-orphan-server-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-server-delete`. База: main `b73001809cd` + runtime-service/connection branches. Claim `3c61fed6e4c`. Код: `6914fdf63232295523314538fc735498ffabe569`.

Полностью удалены в src/vs/workbench/contrib/mcp: common/mcpServer.ts (1530 строк server orchestration/tools/prompts/resources/cache), common/mcpIcons.ts, common/mcpConfigFileUtils.ts, test/common/mcpPrefixGenerator.test.ts и test/common/mcpIcons.test.ts. Удалены только orphan McpDevModeServerAttache и два его теста из common/mcpDevMode.ts и test/common/mcpDevMode.test.ts. Сохранены IMcpDevModeDebugging/McpDevModeDebugging, используемые registry/contributions. Итог: 1858 строк удалено, 4 добавлено в 7 файлах.

После удаления production сборки McpServer в mcp-runtime-service-remove у класса/metadata cache/prefix generator не осталось production consumers. McpIcons использовал только этот сервер; mapping helper уже не использовался. Поиск в src/extensions/build не находит ссылок на удалённые модули/классы. Одноимённые локальные telemetry-типы в mcpServerActions не связаны с удалёнными exports и сохранены.

Проверки: 2 оставшихся common debug tests и 2 native-debug tests прошли; ESLint обоих изменённых TS-файлов прошёл; узкий TypeScript с registry consumer root — 0 diagnostics; git diff --check прошёл. Новые тесты для физического удаления не добавлялись. Полный typecheck/build/package — на интеграционном пакете.

Необходимая зависимость: mcp-runtime-service-remove (`7ce9e5ee9d3`); mcp-server-connection-remove также содержится в ветке, но удалённые файлы он не потребляет. Main уже включает mcp-server-icons-remove. GitHub/auth/Git/SSH и пользовательские настройки/секреты не редактировались; общий authentication API сохранён. Остальные MCP registry/protocol/UI implementations остаются, полное удаление MCP/AI не заявляется.
