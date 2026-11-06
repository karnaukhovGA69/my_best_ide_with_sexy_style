# chat-promo-notifications-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-promo-notifications-disable. База: 235a9b9b24d26ec9a9434123543e47221da91134.

P02/A06: удалить model promo notifications в chat input. Область: src/vs/workbench/contrib/chat/browser/chatPromoNotification.ts и test/browser/chatPromoNotification.test.ts, этот отчёт. Совместимые storage keys оставить; состояние пользователя/общий notification service/GitHub authorization/shared entrypoints не менять.

Код: `a4fde328d68`. Удалены model scan, notification creation, storage/listeners и model-switch actions. Сохранены ID contribution и storage keys для совместимости; пользовательские записи не удаляются.

Проверки: 1 browser test создания с пустым strict DI; ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Full build/typecheck/package — на интеграторе. Дополнительные подключения не нужны.
