# chat-input-notification-analytics-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-input-notification-analytics-disable. База: 0fb7ca8b62c132f6ca88d3923a1e5d0b2a43511c.

P02: удалить сбор аналитики показа/закрытия/действий Chat input notifications. Область: chat/browser/widget/input/chatInputNotificationWidget.ts; chat/test/browser/widget/input/chatInputNotificationWidget.test.ts — только telemetry assertions и regression на отсутствие аналитики; этот отчёт. Сохранить рендеринг/приоритет/доступность/ручные callbacks и обработку ошибок. Producers, auth/catalog, shared entrypoints не менять.

Удалены 5 точек отправки analytics и telemetry DI/type declarations. Identity показа оставлена только для dedup onDidShow, чтобы сохранить callbacks при смене сообщения и не повторять их на повторном рендере. Код: d5c98932abf.

Проверки: 10 целевых browser tests passed (показ, action/mute/dismiss без аналитики, command args, keep-open, rejected commands, model delegate/fallback); ESLint — 2 файла; узкие TypeScript diagnostics — 2 файла, 0 ошибок; git diff --check. Producers/auth/catalog не менялись. Полные build/package/native smoke не запускались; общих подключений и зависимостей нет.
