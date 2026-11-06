# chat-session-option-slash-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-session-option-slash-disable. База: 638bc19a1c891d813b7d0203fd8b01e228e2b5ea.

P02: удалить динамическую регистрацию AI session-option slash commands. Область: src/vs/workbench/contrib/chat/browser/chatSlashCommands.ts — только ChatSessionOptionSlashCommandsContribution, его comment и unused imports; test/browser/chatSessionOptionSlashCommands.test.ts (новый); этот отчёт. Другой ChatSlashCommandsContribution, общие slash APIs/настройки сессий/история/GitHub authorization/shared entrypoints не менять.
