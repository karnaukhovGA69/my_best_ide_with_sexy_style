# chat-collapsible-analytics-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-collapsible-analytics-disable. База: 638bc19a1c891d813b7d0203fd8b01e228e2b5ea.

P02: удалить аналитику раскрытия блоков истории Chat и Terminal Thinking. Область: chat/browser/widget/chatContentParts/chatCollapsibleContentPart.ts; chat/test/browser/widget/chatContentParts/chatCollapsibleContentPart.test.ts (новый); этот отчёт. Сохранить constructor contract для подклассов, rendering/lazy init/accessibility/user toggle events и историю. Общие entrypoints/GitHub authorization не менять.

Удалены logUserToggle, события chat.collapsibleToggle/terminal/chatThinkingBlockToggle, сбор состояния и настройки thinking style. Сигнатура конструктора сохранена для существующих subclass super calls; telemetry-параметр совместимости больше не сохраняется и не используется. Код: c50c0046a2b.

Проверки: 2 новых browser tests (lazy content, раскрытие/сворачивание, пользовательские события, ARIA и inert status) и 2 существующих history/fallback chatThinkingContentPart tests прошли; ESLint — 2 файла; узкие TypeScript diagnostics — 2 файла, 0 ошибок; git diff --check. Полные build/package/native smoke не запускались. Общих подключений и зависимостей нет.
