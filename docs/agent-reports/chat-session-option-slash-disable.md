# chat-session-option-slash-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-session-option-slash-disable. База: 638bc19a1c891d813b7d0203fd8b01e228e2b5ea.

P02: удалить динамическую регистрацию AI session-option slash commands. Область: src/vs/workbench/contrib/chat/browser/chatSlashCommands.ts — только ChatSessionOptionSlashCommandsContribution, его comment и unused imports; test/browser/chatSessionOptionSlashCommands.test.ts (новый); этот отчёт. Другой ChatSlashCommandsContribution, общие slash APIs/настройки сессий/история/GitHub authorization/shared entrypoints не менять.

Удалены подписка на session option groups, динамическая регистрация slash commands и обработчики изменения AI session options. Оставлен инертный contribution ID; первый ChatSlashCommandsContribution сохранён. Код: 2b1f4ad9da6.

Проверки: целевой browser test — 1 passed; ESLint — 2 файла; узкие TypeScript diagnostics — 2 файла, 0 ошибок; git diff --check. Проверка типов обнаружила неиспользуемый import: удалён, lint/types повторно прошли. Full build/package/native smoke не запускались, остаются пакетной проверкой интегратора. Зависимостей и изменений shared entrypoints нет.
