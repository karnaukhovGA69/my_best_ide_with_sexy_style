# ai-terminal-cleanup-refresh

Статус: ГОТОВО К ИНТЕГРАЦИИ; повторного владельца терминальной очистки не назначать до переноса результата. Владелец: отдельный агент актуализации терминальной очистки. Ветка: `agent/ai-terminal-cleanup-refresh`. База: `59f0fde52ec` (main с седьмой итерацией и правилом пакетных сборок). Claim: `28bdfd8a5a4`. Коммит реализации и регрессий: `774605dafb8`.

## Область и происхождение

До правок заняты только `src/vs/workbench/contrib/terminalContrib/chatAgentTools/**`, `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts` и этот отчёт. Отдельный рабочий каталог; документы, MCP, общие entrypoints, Terminal/Tasks, extension API, main, product/build/корневые зависимости и lockfiles не менялись.

При сверке обнаружен уже готовый, но не интегрированный патч `a8f6ce1911c` в `agent/ai-terminal-cleanup`, несмотря на статус «свободно» в плане. Его код перенесён без конфликтов на актуальную базу, а не реализован повторно. Старая ветка и старый отчёт сохранены. Новая работа — актуализация, восемь регрессий миграции таймаута, проверка отложенной регистрации sandbox и повторная целевая проверка всего патча. Класс миграции экспортирован для тестирования; поведение миграции не изменено.

## Результат

При загрузке contribution, SendToTerminalTool и shared renderer больше не регистрируются шесть команд с префиксом `workbench.action.terminal.chat.`: `focusChatInstance`, `continueInBackground`, `toggleChatTerminalOutput`, `focusTerminalById`, `focusTerminalByExecutionId`, `addTerminalSelection`.

Contribution больше не импортирует и не запускает ChatAgentToolsContribution, десять terminal/task AI tools, компрессоры и AgentHostSandboxForwarder; удалена миграция исключительно AI-настройки output location. Настоящий TerminalSandboxService оставлен с delayed DI. Сохранена миграция старого shell integration timeout в обычную настройку терминала.

Исходники AI tools, sandbox и shared Chat renderer частично остаются, включая локальные callbacks и command URI в незарегистрированных tools. Это не полное удаление AI/MCP и не доказательство отсутствия сети.

## Проверки текущей ветки

- `git diff --check`: успешно; проверены границы diff и наличие обязательных базовых коммитов среди предков HEAD.
- `pnpm run eslint` для трёх изменённых runtime-файлов и `terminalAgentToolsRegistration.test.ts`: 4 файла, успешно.
- `terminalAgentToolsRegistration.test.ts` вместе с существующим `terminalContrib/chat/test/browser/unavailableTerminalChat.test.ts`: **13 tests, 13 passed** в headless Chromium. Реальные модули собраны целевым esbuild bundle; Mocha и repository assert shim, без подмены product-модулей. CSS/шрифты исключены из тестового bundle. Это browser-проверка, не штатный Electron runner и не native smoke.
- Восемь новых случаев: перенос user/workspace в свои scopes; сохранение явных новых значений (включая 0); независимость scopes в обоих направлениях; перенос старого 0 при наличии нового default; отсутствие записи унаследованного legacy default; отказ от строк/boolean; сохранение корректного workspace при null в user. Проверка sandbox дополнена требованием delayed instantiation.
- Зависимости установлены отдельно через `pnpm --filter code-oss-dev install --frozen-lockfile --ignore-scripts`, без изменения manifests/lockfile. Launcher среды использует pnpm 11.25.0 при закреплённом 12.16.0; это ограничение окружения, версии проекта не менялись. Первые попытки offline и ignore-workspace не подошли; успешная установка использовала workspace-конфигурацию и прошла supply-chain policy check.

Полный typecheck, production bundle/package, подпись, native smoke и релиз не запускались: они остаются общим этапом интегратора по правилу пакетных сборок.

## Интегратору

Перенести `agent/ai-terminal-cleanup-refresh` или кодовый коммит `774605dafb8` вместе с этим отчётом. Это замена переносу старого `a8f6ce1911c`, а не дополнительный независимый патч: не применять обе реализации повторно. Если старая уже интегрирована, нужны только новые регрессии и экспорт класса миграции из этой ветки.

Общие подключения не требуются. Сохранить существующий импорт `terminal.chatAgentTools.contribution` в `src/vs/workbench/contrib/terminal/terminal.all.ts`: он обеспечивает sandbox DI и миграцию обычной настройки таймаута.

На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/terminalAgentToolsRegistration.test.js` и существующий `vs/workbench/contrib/terminalContrib/chat/test/browser/unavailableTerminalChat.test.js`; typecheck/сборку объединить с остальным пакетом. В native smoke проверить отсутствие всех шести ID через `vscode.commands.getCommands(true)` после открытия терминала и изменения настроек, zsh/bash, shell Task exit0, навигацию/выделение/копирование, ручной ввод и extension terminal create/sendText/dispose. Сохранность этих native-сценариев данным browser-запуском не подтверждена.

Работа готова как независимая task-ветка. В main ещё не объединена, новый бинарный релиз не создан.
