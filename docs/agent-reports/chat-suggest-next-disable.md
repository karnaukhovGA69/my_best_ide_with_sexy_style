# chat-suggest-next-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-suggest-next-disable. База: 9be3b2c89dcbbb932398794f2f8d18a022fb398f.

P02: удалить suggested AI handoff widget/buttons. Область: src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatSuggestNextWidget.ts; browser/widget/chatWidget.ts — только renderChatSuggestNextWidget и приватные типы shown telemetry; test/browser/widget/chatContentParts/chatSuggestNextWidget.test.ts (новый); этот отчёт. Удалить также auto-send из этого render path и shown analytics, сохранив прочий chat lifecycle/history. GitHub authorization/shared entrypoints исключены.

Код: `2e20fb5cb43`. Удалены handoff/autopilot buttons, observers/service dependencies и чтение mode handoffs в виджете; container остаётся пустым/скрытым для layout compatibility. ChatWidget render path больше не читает историю/модели, не делает auto-send и не отправляет shown analytics. Иные ручные handoff handlers вне scope сохранены.

Проверки: 2 browser tests, ESLint 3 файлов, selected-file semantic types 3 файлов (0 diagnostics после удаления неиспользуемого IChatMode import), git diff --check — passed. Full build/typecheck/package — интегратор. Дополнительные подключения не нужны.
