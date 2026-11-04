# Промпт агента

```text
Работай только с нашим форком Myself IDE. Прочитай AGENTS.md, docs/development-plan.md, docs/document-export-contract.md и своё задание ниже. Не трогай оригинальный VS Code и upstream. Работай в отдельном checkout/worktree на своей ветке от актуального main с седьмой итерацией и правилом пакетных сборок; не переключай общий рабочий каталог. Проверь git status и базу до правок. Не запускай других агентов без отдельного поручения.

Не меняй чужие области, общие entrypoints, product/build/корневые зависимости/lockfiles. Не запускай полную сборку и не публикуй релиз. Делай релевантные локальные проверки, используй существующую инфраструктуру. Все нужные общие подключения передай интегратору. Итог: реальные изменения, проверки, коммит/ветка и собственный отчёт с ограничениями. Не объявляй готовым неподключённый end-to-end сценарий.

Задание ai-terminal-cleanup. Ветка agent/ai-terminal-cleanup. Твоя область: src/vs/workbench/contrib/terminalContrib/chatAgentTools/**; src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts; docs/agent-reports/ai-terminal-cleanup.md.

Продолжи удаление оставшихся встроенных терминальных AI-инструментов и команд. Начни с шести команд, ещё найденных в реальном v0.0.6: workbench.action.terminal.chat.focusChatInstance, continueInBackground, toggleChatTerminalOutput, focusTerminalById, focusTerminalByExecutionId, addTerminalSelection (у всех один prefix workbench.action.terminal.chat.). Найди реальных регистраторов, зависимости и side effects, затем убери регистрации/загрузку AI tools в своей области. Не удаляй общие terminal API и не ломай интерфейсы shared chat; пустые совместимые контракты допустимы с явной фиксацией оставшегося кода.

Не меняй src/vs/workbench/contrib/terminal/**, terminalContrib/chat/**, Tasks, extension host, общие entrypoints или файлы других агентов. Если отключение импорта в общей точке необходимо, опиши точную правку для integration. Не затрагивай новое PDF/documents направление.

Приёмка: целевые AI команды/инструменты больше не регистрируются в интегрированной сборке; zsh/bash, shell Task exit0, обычная терминальная навигация, выделение, копирование, ручные команды пользователя и API терминала расширений сохранены. Проверь unit-регрессии именно удаления и совместимости. Наличие классов/исходников в source отдельно от runtime. В отчёте не заявляй нулевую сеть или полное удаление всего AI/MCP.
```
