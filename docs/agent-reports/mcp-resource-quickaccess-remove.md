# mcp-resource-quickaccess-remove

Статус: ГОТОВО / ожидает интеграции в следующий пакет. Владелец: агент mcp-workbench-inventory-remove. Ветка: `agent/mcp-resource-quickaccess-remove`. База при старте: `670cc65fce4` (main после 0.0.8). Claim до реализации: `b8d43e48940`. Код и тесты: `4328dcc53f0f4a834ece9a629d4e0caa9962ed38`.

Область: `src/vs/workbench/contrib/mcp/browser/mcpResourceQuickAccess.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpResourceQuickAccess.test.ts`, этот отчёт. Чужие файлы не изменены.

Удалены McpResourcePickHelper и AbstractMcpResourceAccessPick вместе с загрузкой ресурсов, подписками на серверы, навигацией по вложенным ресурсам, URI templates, преобразованием в attachments, открытием ресурсов и добавлением в чат. Производственный diff: 585 удалённых строк, 15 добавленных. Это удаление реализации, а не переключение feature flag.

Остались две неактивные совместимые оболочки. McpResourceQuickPick сохраняет аргумент server и асинхронный pick, но не читает server, не требует сервисов и завершается без UI. Метод намеренно не отклоняет Promise: существующий McpBrowseResourcesCommand вызывает pick без await/catch. McpResourceQuickAccess сохраняет PREFIX/defaultFilterValue и provide, очищает items/busy, не подписывается на события и возвращает Disposable.None. При явном вызове старого quick access останется пустой picker; общая регистрация в этой задаче не удаляется.

Проверки:
- 4 новых browser unit tests: пройдены в Chromium через временный esbuild/Mocha harness, без полной сборки. Проверены создание обоих классов штатным InstantiationService с пустым ServiceCollection, отсутствие чтения server, завершение с отменённым token, очистка старых результатов/busy, отсутствие подписок и безопасный повторный dispose.
- Регрессионный контроль: те же 4 теста с production-файлом из базы 670cc65fce4 ожидаемо падают на прежних DI dependencies (editorService); исходники на диске при этом не заменялись. Это проверка чувствительности тестов, не успешный прогон старой реализации.
- Целевой ESLint двух файлов: пройден.
- Узкая TypeScript-проверка двух файлов с транзитивными типами и ambient declarations: 0 diagnostics. Полный client typecheck не запускался.
- git diff --check: пройден. Поиск src/extensions подтвердил отсутствие внешних потребителей удалённых helper/base; оставшиеся imports в mcpCommands.ts/mcp.contribution.ts совместимы с сохранёнными классами.

Интегратору: включить ветку/коммит в следующий пакет. Регистрация McpResourceQuickAccess в mcp.contribution.ts и вызовы в McpBrowseResourcesCommand сохранены; их окончательная очистка — отдельная общая задача. Предыдущие MCP задачи уже включены в 0.0.8, повторно переносить их не нужно. Полный build/package/native smoke/release не выполнялись. Обычные Quick Input, редакторы, IntelliSense, Terminal/Tasks, Git/SSH, документы и voice этой правкой не затронуты; полный нативный smoke остаётся интегратору. Полное удаление MCP/AI из проекта не заявляется.
