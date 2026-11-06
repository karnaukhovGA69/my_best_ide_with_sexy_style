# chat-pet-widget-runtime-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-pet-widget-runtime-disable. База: eab8fa4a00d3ad7911a0431fa0fe051320affb90.

A06: отключить создание встроенного chat pet через widget service, удалить координатор окон/фокуса. Область: src/vs/workbench/contrib/chat/browser/widget/chatPetWidgetService.ts и src/vs/workbench/contrib/chat/test/browser/widget/chatPetWidgetService.test.ts, этот отчёт. Контракт регистрации сохранить инертным. Общие entrypoints, настройки/хранилища, GitHub и другие занятые задачи исключены.

Код: `d5830e392b8`. Удалён координатор окон/DOM/фокуса и создание ChatPetWidget. Сервис не запрашивает DI-зависимости; register возвращает постоянно неактивный disposable, getFocusedJumpGame — undefined. Единственный потребитель прежнего экспортированного координатора был его тест; заменён регрессионными проверками отключённого runtime. Данные пользователя не читаются/не изменяются.

Проверки: 2 browser tests passed; ESLint 2 files passed; targeted semantic/syntax TypeScript 2 files, 0 diagnostics; git diff --check passed. Full typecheck/package не запускались.

Интегратору: принять ветку; wiring не требуется. ChatPetWidget и остальные pet реализации пока остаются в исходниках, полное удаление не заявляется.
