# ai-terminal-cleanup-refresh

Статус: ЗАНЯТО / в работе. Владелец: отдельный агент актуализации терминальной очистки. Ветка: `agent/ai-terminal-cleanup-refresh`. База: `59f0fde52ec` (актуальный main). Старый готовый патч: `a8f6ce1911c`, ветку `agent/ai-terminal-cleanup` не изменять.

Зарезервировано до реализации: `src/vs/workbench/contrib/terminalContrib/chatAgentTools/**`, `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts`, этот отчёт. Не назначать второго владельца терминальной AI-очистки. Documents UI, MCP, общие entrypoints, main и сборки остаются у существующих владельцев.

Задача: перенести готовый патч без повторной реализации на актуальную базу, проверить отсутствие конфликтов и дополнить регрессии миграции shell integration timeout / сохранения sandbox DI. Полную сборку и native smoke выполняет интегратор в общем пакете.
