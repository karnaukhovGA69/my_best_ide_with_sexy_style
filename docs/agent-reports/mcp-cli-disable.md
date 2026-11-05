# mcp-cli-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент ранее mcp-sampling-log-disable. Ветка: `agent/mcp-cli-disable`. База: `59f0fde52ec`.

Область помечена занятой в общем отчёте до реализации. Claim: `638af6cdf3b`. Код и тесты: `e2d336ca871`.

## Область и результат

Задача A05. Изменены только `src/vs/platform/mcp/common/mcpManagementCli.ts`, новый `src/vs/platform/mcp/test/common/mcpManagementCli.test.ts` и этот отчёт.

Удалены разбор/валидация JSON definitions, вызовы IMcpManagementService.install, лог успешной установки и ошибки с содержимым пользовательского ввода. Удалена DI-зависимость от IMcpManagementService: CLI handler больше не вызывает создание management service. Logger принимается ради совместимости существующего вызова, но не сохраняется и не читается.

Оставлен совместимый McpManagementCli.addMcpDefinitions(string[]): Promise<void>. Любой вызов отклоняется локализованной ошибкой `MCP is not available in this IDE.` до чтения аргументов. Пустой массив также получает отказ. Это намеренно отключённый endpoint, а не успешная заглушка установки. Существующие конфигурации не удаляются и не изменяются этим обработчиком.

## Проверки

- 4 unit tests прошли в Node через временный esbuild/Mocha harness. Включена проверка утечек disposables.
- Проверены прежняя форма createInstance(McpManagementCli, logger).addMcpDefinitions(...), strict DI без management service и отсутствие создания зарегистрированного lazy service, конструктор которого бросает ошибку.
- Throwing Proxy проверяют отсутствие чтения management service, logger и массива definitions. Проверены пустой ввод, stdio/HTTP definitions, несколько definitions, malformed JSON, null, отсутствующие поля и смешанный batch. В фикстурах только синтетические значения; точный текст ошибки не включает ввод.
- Проверка чувствительности: с исходным production-модулем из `59f0fde52ec` два теста ожидаемо падают — создание management service и обращение к logger. Подмена выполнена только в памяти bundler; checkout не изменялся.
- Целевой ESLint двух TS-файлов прошёл. Имеющийся launcher pnpm выдал предупреждение о неизвестном workspace-поле skills; зависимости не менялись.
- Узкая TypeScript noEmit проверка двух файлов и их зависимостей: 684 файла графа, 0 диагностик без фильтрации. Это не полный client typecheck.
- `git diff --check` и проверка staged diff прошли. Временные файлы этого задания удалены после проверок.

## Интегратору и ограничения

Единственный production caller найден в `src/vs/code/node/cliProcessMain.ts`: прежний вызов через DI совместим с сохранённым logger argument. Общие CLI entrypoints/help/options не менялись; legacy `--add-mcp` остаётся распознаваемым и доходит до явного отказа. Удаление help/options можно выполнить при общей очистке CLI. CLI bootstrap вне этого handler может создавать другие сервисы; отсутствие всех побочных действий CLI здесь не заявляется.

Обычные extension CLI операции, ручная установка VSIX, MCP management service/contracts, общие подключения, main/build/dependencies и области других агентов не менялись. Ветка независима от ранее подготовленных MCP gallery/API/sampling/discovery изменений; дополнительных подключений не требует.

Интегратору перенести task-ветку после review в общий пакет. Полные typecheck/build/package, запуск packaged CLI/native smoke и релиз здесь не проводились согласно правилу пакетной интеграции. Полное удаление AI/MCP или всех путей установки MCP этим локальным изменением не заявляется. В main пока не объединено.
