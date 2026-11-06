# mcp-orphan-connection-tasks-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-connection-tasks-delete`. База main `411cccde06e` + цепочка agent/mcp-registry-runtime-remove. Claim `a453769d6bd`. Код: `49e6c06b056875972bc1cd353e58af26f4108eaf`. Для следующего пакета после frozen release-0.0.9.

Полностью удалены common/mcpServerConnection.ts, common/mcpTaskManager.ts, test/common/mcpServerConnection.test.ts, test/common/mcpTaskManager.test.ts и неиспользуемый helper test/common/mcpRegistryTypes.ts. В production common/mcpRegistryTypes.ts удалены только import McpTaskManager и property taskManager из IMcpResolveConnectionOptions. После удаления реестром создания connection и удаления RPC runtime этим фасадам/fixtures не осталось потребителей. Общие IMcpServerConnection/IMcpRegistry/transport contracts сохранены.

Поиск src/extensions/build TS/JS не находит deleted modules/classes/fixtures. 7 registry boundary tests прошли; ESLint единственного изменённого файла прошёл; узкий TypeScript с registry tests и MCP browser contribution root — 0 diagnostics; git diff --check прошёл. 541 строка удалена в 6 файлах, добавлений нет. Новые тесты на удаление orphan code не добавлялись.

Необходимы mcp-registry-runtime-remove (`61e3a103990`) и mcp-request-handler-runtime-delete (`d5ca4686f76`) со своей цепочкой; всё присутствует в ветке. Свежий main объединён только в собственный checkout, package/lock dependencies не менялись. Обычные workbench Tasks, GitHub/auth/Git/SSH, пользовательские данные не менялись. Полный client typecheck/build/package/native smoke выполняет интегратор следующим пакетом.
