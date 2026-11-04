# mcp-sandbox-launch-remove

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-sandbox-launch-remove`. База: `59f0fde52ec`.

Задача A05. Резервирование до реализации: `33f4097b526`; копия сразу помещена в собственный отчёт общего checkout. Реализация и тесты: `1ba7df80e47` (`Remove MCP sandbox launch and configuration implementation`).

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpSandboxService.test.ts` и этот отчёт.

Удалена MCP-specific sandbox реализация: constructor remote environment lookup, вычисление runtime/executable/temp paths, аргументы и переменные окружения wrapper, создание временного JSON-конфига, default permission grants, подсказки по блокировкам, обновление sandbox permissions через resource scanner. Удалены MCP-only helpers `mcpDefaultCwdToFsPath` и `resolveMcpServerSandboxWorkingDirectory`: поиск по src/extensions выявил только удалённую реализацию и её прежние тесты; после правки ссылок не осталось.

Сохранены service decorator/interface, McpSandboxService, IDisposable-совместимость и сигнатуры методов. `launchInSandboxIfEnabled` всегда отклоняется локализованной ошибкой «MCP server launches are disabled in Myself IDE.», до чтения definition/launch, независимо от stdio/HTTP, remote и sandboxEnabled. Исходный launch не возвращается: удаления wrapper с продолжением несandboxed запуска нет. `isEnabled` возвращает false, suggestion — undefined, apply — false без чтения/записи конфигурации или фиктивного успеха.

Проверен production caller `mcpRegistry.ts`: он безусловно вызывает launchInSandboxIfEnabled при подготовке соединения; catch сообщает ошибку и возвращается до дальнейшего создания соединения. Это статическая проверка caller, не интеграционный запуск реестра. `mcpServer.ts` использует сохранённые suggestion/apply signatures; undefined отключает предложение изменения разрешений. Регистрация singleton остаётся совместимой и не требует изменения contribution-файла.

Общие `platform/sandbox/common/terminalSandboxService.ts`, Terminal/Tasks, процессный transport, SSH/remote infrastructure, registry/server, contribution-файлы, main/build/dependencies и области других агентов не менялись. Пользовательские файлы, permissions и старые sandbox config files не читались и не удалялись.

## Проверки

- 7/7 новых unit tests прошли через временный esbuild/Mocha/Playwright harness в headless Chromium из существующих зависимостей своего checkout. Page errors нет; включён disposable leak checker.
- Strict DI без file/remote/environment/scanner services и повторный dispose. Матрица local/remote × sandboxEnabled false/true проверяет точную ошибку для stdio и HTTP, без возврата исходной launch configuration.
- Poison getters подтверждают отказ до чтения definition/transport и отсутствие чтения definition/permissions при capability/suggestion/apply. Apply проверен для USER, USER_REMOTE, WORKSPACE и WORKSPACE_FOLDER; результат false. Реальные файлы, процессы, remote и сеть не использовались.
- Контроль чувствительности: только startup DI test запущен с исходным production-модулем из `59f0fde52ec`, подставленным в память bundler. Получено ожидаемое падение на обязательном fileService. Остальные 6 тестов на старой реализации не запускались; checkout не менялся.
- Прежние тесты генерации sandbox config/path helpers заменены проверками удалённого поведения. Общая terminal sandbox инфраструктура этим suite не проверяется.
- Целевой ESLint обоих TS-файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts src/vs/workbench/contrib/mcp/test/common/mcpSandboxService.test.ts`. Финальный тестовый файл перепроверен после уточнения полей fixtures.
- Узкая TypeScript noEmit проверка с options `src/tsconfig.json`, двумя файлами и транзитивными imports: 0 diagnostics без фильтрации; включены существующие Node/src/typings, Monaco и DebugProtocol declarations. Полного client typecheck не было.
- `git diff --check` прошёл; временный harness удалён. Зависимости не обновлялись, production bundle/package и native smoke не запускались.

## Интегратору и ограничения

Ветка независима от предыдущих task-веток, основана на main. Дополнительных подключений не требуется. Перенести `33f4097b526`, `1ba7df80e47` и финальный коммит отчёта либо merge ветки после review. Включить в накопленный пакет; при общей интеграции проверить отказ MCP startup через registry и обычные Terminal/Tasks/sandbox сценарии.

Это удаление MCP sandbox launch/config adapter с запретом запуска через него, а не всей MCP runtime/transport infrastructure. Другие прямые launch paths вне данного adapter не проверены; не заявлять полное удаление MCP/AI. В main ещё не объединено; самостоятельной сборки или релиза нет.
