# chat-prompt-discovery-logging-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-prompt-discovery-logging-disable. База: be461ce28664e8257d083f6abebd2622bf9f1b8b.

P02/A07: удалить автоматический сбор prompt discovery/customization details в AI debug events. Область: src/vs/workbench/contrib/chat/browser/promptsDebugContribution.ts и test/browser/promptsDebugContribution.test.ts, этот отчёт. Удалить observers/extra discovery requests/resolvers/maps/forwarding; сохранить contribution ID. Реальную prompt discovery, общие логи, пользовательскую историю/GitHub authorization/shared entrypoints не менять.
