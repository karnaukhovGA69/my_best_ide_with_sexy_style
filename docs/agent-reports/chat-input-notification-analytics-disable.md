# chat-input-notification-analytics-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-input-notification-analytics-disable. База: 0fb7ca8b62c132f6ca88d3923a1e5d0b2a43511c.

P02: удалить сбор аналитики показа/закрытия/действий Chat input notifications. Область: chat/browser/widget/input/chatInputNotificationWidget.ts; chat/test/browser/widget/input/chatInputNotificationWidget.test.ts — только telemetry assertions и regression на отсутствие аналитики; этот отчёт. Сохранить рендеринг/приоритет/доступность/ручные callbacks и обработку ошибок. Producers, auth/catalog, shared entrypoints не менять.
