# chat-goal-summary-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-goal-summary-disable. База: 5407307c532ea63b4a5cfe3904338259fd6318c2.

P02: удалить background AI goal summarization, prompt cache и orphan summary formatter. Область: src/vs/workbench/contrib/chat/browser/chatGoalSummaryService.ts и test/browser/chatGoalSummaryService.test.ts, этот отчёт. Сохранить DI/service interface и summarize(undefined result) compatibility. Chat history/user prompts не менять, GitHub authorization/shared entrypoints исключены.
