# mcp-server-icons-remove

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-server-icons-remove`. База: `62f2cc32a7c`. Claim: `655d8495118`. Код/тесты: `d5ec0ffbcbefb3f520c1bea6f8c619cba46ed271`.

Изменены `src/vs/workbench/contrib/mcp/common/mcpIcons.ts`, соответствующий `test/common/mcpIcons.test.ts` и этот отчёт. Удалены URL validation/parsing, MIME lookup, URI revival из кеша, theme/size selection и хранение иконок. Сохранены ParsedMcpIcons/StoredMcpIcons и data shapes для metadata consumer. parseAndValidateMcpIcon возвращает новый пустой массив; McpIcons.fromStored/fromParsed не читают аргументы; getUrl всегда undefined. Обычные theme/editor/extension icons и GitHub auth не изменены.

Проверки: 4 browser tests прошли — HTTP/stdio, все ранее поддержанные источники (http/https/file/data), старые cache URLs, отсутствие чтения metadata/launch/logger/cache, разные sizes и undefined inputs. Предыдущие tests активного выбора иконок заменены tests unavailable-контракта. Те же 4 новых теста на baseline production-файле ожидаемо падают. ESLint двух файлов, узкий TypeScript (0 diagnostics), git diff --check прошли. Главный consumer McpServer сохраняет совместимость exports/data types; собственный renderer классу не требуется. Реальных сетевых запросов в тестах нет.

Интегратору: независимая ветка, общие build/typecheck/package/native smoke остаются для пакета. Сохранённые metadata types не означают, что URLs разрешены к рендерингу. Полное удаление MCP/AI не заявляется.
