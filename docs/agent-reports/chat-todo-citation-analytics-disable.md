# chat-todo-citation-analytics-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-todo-citation-analytics-disable. База: 638bc19a1c891d813b7d0203fd8b01e228e2b5ea.

P02: удалить аналитику раскрытия/очистки списка задач и открытия цитат. Область: chat/browser/widget/chatContentParts/chatTodoListWidget.ts, chatCodeCitationContentPart.ts; chat/test/browser/widget/chatContentParts/chatTodoListWidget.test.ts, chatCodeCitationContentPart.test.ts (новый); этот отчёт. Сохранить отображение, ручные операции, историю и доступность. Общие entrypoints/GitHub authorization не менять.

Удалены события аналитики, расчёт количества задач для аналитики и telemetry DI из обоих компонентов. Рендеринг, доступность, раскрытие/очистка и локальное открытие текста цитат сохранены. Код: f7bc53bee1d.

Проверки: 12 browser tests passed (включая прежние accessibility tests, взаимодействия без telemetry и точное содержимое цитаты в локальном редакторе); ESLint — 4 файла; узкие TypeScript diagnostics — 4 файла, 0 ошибок; git diff --check. Полные build/package/native smoke оставлены интегратору на общий пакет. Зависимостей и общих подключений нет.
