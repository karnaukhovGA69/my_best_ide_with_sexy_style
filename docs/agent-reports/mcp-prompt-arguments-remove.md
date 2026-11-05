# mcp-prompt-arguments-remove

Статус: ГОТОВО / ожидает интеграции в следующий пакет. Владелец: агент mcp-resource-quickaccess-remove. Ветка: `agent/mcp-prompt-arguments-remove`. База: `81efa000a9f` (актуальный main при старте). Claim до правок: `013efa92eee`. Код и тесты: `5c1d0a9a7d2557c6ec18ba36da983b0d56b94cb5`.

Область: `src/vs/workbench/contrib/mcp/browser/mcpPromptArgumentPick.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpPromptArgumentPick.test.ts`, этот отчёт. Конфликтов областей с текущими documents-unicode-find и voice-mic-capture-disable нет.

Удалены UI ввода аргументов и навигация назад, MCP prompt completions, поиск/чтение файлов, доступ к активному редактору и выделению, создание MCP Terminal и выполнение команды для подстановки stdout, shell-integration ожидание и таймеры, reactive subscriptions. Производственный diff: 398 удалённых строк, 7 добавленных. Общие Terminal/Tasks, search/file/editor services и IntelliSense не изменены.

Остался минимальный Disposable-класс McpPromptArgumentPick: прежний prompt-параметр конструктора не читается и не сохраняется, service decorators отсутствуют. createArgs сохраняет асинхронный контракт и возвращает undefined, который существующий потребитель трактует как отмену. Даже промпт с пустым arguments не получает успешный пустой объект. Повторные вызовы, отменённый token и повторный dispose безопасны.

Проверки:
- 3 новых browser unit tests прошли в Chromium через временный esbuild/Mocha harness; page errors нет. Проверены создание штатным InstantiationService без сервисов, отсутствие чтения prompt/token, отмена промпта без аргументов без вызова resolve, повторные вызовы после dispose.
- Регрессионный контроль одного DI-теста с production-файлом из базы 81efa000a9f ожидаемо упал на прежней зависимости quickInputService. Исходники на диске не заменялись; это проверка чувствительности, не успешный прогон прежней реализации.
- Целевой ESLint обоих файлов: пройден.
- Узкая TypeScript-проверка обоих файлов и транзитивных типов с ambient declarations: 0 diagnostics. Полный client typecheck не запускался.
- git diff --check: пройден. Поиск src/extensions подтвердил единственный внешний consumer в chatInputCompletions.ts; сохранены используемые constructor/createArgs/dispose.

Интегратору: включить ветку/коммит в следующий пакет. Предыдущая ветка agent/mcp-resource-quickaccess-remove независима и остаётся отдельным готовым изменением; этот коммит не включает её реализацию. Сборка, упаковка, native smoke и release не запускались.

Ограничение: общий обработчик MCP-промпта в `src/vs/workbench/contrib/chat/browser/widget/input/editor/chatInputCompletions.ts` ещё открывает chat widget и вызывает server.start ДО createArgs. Этот файл не входит в область задачи; удаление его MCP-action/completion flow требует отдельного назначения. Тест отмены воспроизводит ветку if(args) потребителя, а не запускает весь action. Полное прекращение MCP server startup или удаление всего MCP/AI данным патчем не заявляется. Для интеграции остаются общие DI/typecheck/startup/native проверки пакета.
