# chat-goal-summary-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-goal-summary-disable. База: 5407307c532ea63b4a5cfe3904338259fd6318c2.

P02: удалить background AI goal summarization, prompt cache и orphan summary formatter. Область: src/vs/workbench/contrib/chat/browser/chatGoalSummaryService.ts и test/browser/chatGoalSummaryService.test.ts, этот отчёт. Сохранить DI/service interface и summarize(undefined result) compatibility. Chat history/user prompts не менять, GitHub authorization/shared entrypoints исключены.

Код: `65990fbfbab`. Удалены model selection/request, prompt cache/in-flight map и orphan cleanGoalSummary helper. summarize сохраняет Promise contract и всегда undefined, без DI или чтения cancellation state.

Проверки: 2 browser tests (повторные/длинные/пустые/отменённые вызовы и unreadable cancellation); ESLint 2 файлов; selected-file semantic types (0 diagnostics); helper reference scan 0; git diff --check — passed. Full typecheck/build/package — интегратор. Подключений нет.
