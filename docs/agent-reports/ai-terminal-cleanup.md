# ai-terminal-cleanup

Статус: реализация завершена, готова к интеграции. Владелец: отдельный агент ai-terminal-cleanup. Ветка: `agent/ai-terminal-cleanup`. База: `d430382a161` (main, потомок шестой итерации `b911234c7b1`). Изменения приложения пока не объединены в main и не проверены в новом native package.

## Границы

Изменены только `src/vs/workbench/contrib/terminalContrib/chatAgentTools/**`, `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts` и этот отчёт. Не изменены PDF/documents, MCP, обычные Terminal/Tasks, extension host, общий entrypoint, package/lockfiles, настройки продукта и чужой checkout. Отдельные ветка, каталог и установленные зависимости; полная сборка не запускалась.

## Причина и результат

Скрытие Chat и ранее отключённый Terminal Chat не мешали загрузке других регистраторов. `src/vs/workbench/contrib/terminal/terminal.all.ts` импортирует `terminalContrib/chatAgentTools/browser/terminal.chatAgentTools.contribution.ts`. Этот entrypoint импортировал реализации tools, регистрировал `ChatAgentToolsContribution` и `AgentHostSandboxForwarder`. Отдельный shared Chat renderer регистрировал ещё три команды при загрузке модуля.

У всех шести команд ниже префикс `workbench.action.terminal.chat.`:

| Команда | Регистратор до изменения | Изменение |
| --- | --- | --- |
| `addTerminalSelection` | `chatAgentTools/browser/terminal.chatAgentTools.contribution.ts`: `registerActiveInstanceAction` | Удалены action, пункт контекстного меню, импорты Chat/attachment API |
| `focusTerminalById` | `chatAgentTools/browser/tools/sendToTerminalTool.ts`: `CommandsRegistry.registerCommand` | Удалена регистрация и обработчик; импорт модуля больше не добавляет команду |
| `focusTerminalByExecutionId` | Тот же модуль | Удалена регистрация и обработчик |
| `focusChatInstance` | `chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts`: `CommandsRegistry.registerCommand` | Удалена регистрация и обработчик |
| `continueInBackground` | Тот же shared renderer | Удалена регистрация и обработчик |
| `toggleChatTerminalOutput` | Тот же shared renderer | Удалена регистрация и обработчик |

Полностью удалён класс `ChatAgentToolsContribution` и его startup-регистрация: он больше не создаёт/регистрирует десять terminal/task AI tools (`ConfirmTerminalCommandTool`, `GetTerminalOutputTool`, `KillTerminalTool`, `SendToTerminalTool`, `RunInTerminalTool`, `GetTerminalSelectionTool`, `GetTerminalLastCommandTool`, `RunTaskTool`, `GetTaskOutputTool`, `CreateAndRunTaskTool`), не добавляет их в read/execute toolsets, не регистрирует компрессоры и не подписывается на изменение approval/sandbox настроек для повторной регистрации run tool.

Удалены импорт и startup-регистрация `AgentHostSandboxForwarder`: этот entrypoint больше не запускает его подписки на connections/configuration и передачу sandbox-настроек агентам. Удалена `OutputLocationMigrationContribution`, которая меняла исключительно AI-настройку вывода. Это удаление загрузки и регистрации, а не замена precondition или скрытие интерфейса.

## Сохранённая совместимость и ограничения

- `ITerminalSandboxService` по-прежнему получает настоящий `TerminalSandboxService` с `InstantiationType.Delayed`. Не подменён на разрешающий unsandboxed-выполнение null-service. Существующая sandbox-реализация и её общие зависимости остались; при обращении к ней она может создаваться. Не утверждаем отсутствие всех её listeners или network paths.
- Сохранена `ShellIntegrationTimeoutMigrationContribution`: перенос числового старого user/workspace timeout в обычный `terminal.integrated.shellIntegration.timeout`, только если соответствующее новое значение не задано. Не теряется настройка обычного терминала.
- Shared renderer, публичные типы, константы ID и классы AI tools пока остаются в исходниках. В том числе старый незарегистрированный `SendToTerminalTool` сохраняет генерацию command URI, а renderer — локальные toolbar callbacks. Нельзя утверждать удаление всего Chat, всех AI-инструментов или всех транзитивных импортов.
- MCP-аудит не пересекается по изменяемым файлам. При будущей очистке sandbox/shared Chat согласовать его потребителей отдельно; этот патч не удаляет platform sandbox, GitHub authentication, SSH или API пользовательских расширений.

## Проверки

1. `git diff --check` — пройдено.
2. Целевой `pnpm run eslint` для трёх изменённых runtime-файлов и нового теста — 4 файла, пройдено.
3. Новый `chatAgentTools/test/browser/terminalAgentToolsRegistration.test.ts`: импортирует реальный contribution, `sendToTerminalTool` и shared renderer; проверяет отсутствие шести команд в настоящем `CommandsRegistry` и сохранение настоящего DI descriptor sandbox. Вместе с существующим `chat/test/browser/unavailableTerminalChat.test.ts` — 5 тестов, 5 passed, Chromium. Выполнен отдельный целевой esbuild bundle этих двух suites и Mocha в headless Chromium, с репозиторным assert shim; CSS исключён из тестового bundle. Product-модули не подменялись. Это проверка модулей/DI, не визуальный или native smoke, не полный штатный Electron test runner.
4. Дополнительно изолированно выполнены три изменённых транспилированных модуля с подменёнными зависимостями: исходная база воспроизводит все шесть регистраций, новая — ни одной; единственный оставшийся workbench contribution — timeout migration. Проверены отсутствие eager imports tools/forwarder/compressor в entrypoint, реальная delayed sandbox-регистрация, перенос user/workspace timeout, сохранение явно заданных новых значений и отклонение нечисловых значений. Эта дополнительная проверка не заменяет тесты с реальным registry из пункта 3.
5. Полный client typecheck, production bundle и native zsh/bash/Tasks smoke не запускались: это работа интегратора. Зависимости установлены отдельно через pnpm с frozen lockfile и без lifecycle scripts; lockfile и manifest не изменились. Доступный launcher использовал pnpm 11.25.0 при `packageManager` 12.16.0; никаких обновлений версий не сделано.

## Интегратору

- Перенести реализацию из ветки `agent/ai-terminal-cleanup`, просмотреть diff и выполнить общие проверки на объединённом дереве. Новых зависимостей и изменений PDF-контракта нет. Коммит реализации указан в финальном сообщении задачи; статусный коммит отчёта, если есть, переносить вместе с ним.
- Общие точки подключения менять не нужно. Существующий импорт в `src/vs/workbench/contrib/terminal/terminal.all.ts` необходимо сохранить: теперь он обеспечивает sandbox DI и миграцию обычного timeout. Не удалять его целиком без переноса этих двух функций.
- На готовом output выполнить `scripts/test.sh --run vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/terminalAgentToolsRegistration.test.js`, а также существующий `vs/workbench/contrib/terminalContrib/chat/test/browser/unavailableTerminalChat.test.js`. При интеграции выполнить предусмотренные планом общие typecheck/build checks один раз.
- В native smoke использовать `vscode.commands.getCommands(true)`: все шесть целевых ID должны отсутствовать; желательно проверять весь префикс `workbench.action.terminal.chat.`. Повторить после открытия терминала и смены настроек. Не проверять только видимость меню.
- Проверить zsh и bash (команда с записью результата), shell Task exit0, обычную навигацию терминала, выделение/копирование, ручной ввод, создание/sendText/dispose терминала через extension API, Git/SSH и ручной VSIX. Не выдавать browser suite за эту приёмку.
- Публикация нового приложения и объединение в main принадлежат интегратору. Текущий результат — готовый независимый патч, не новый релиз.
