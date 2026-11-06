# chat-pet-telemetry-remove

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-pet-telemetry-remove. База: eab8fa4a00d3ad7911a0431fa0fe051320affb90.

Удаление chatPetEnablement analytics. Область: src/vs/workbench/contrib/chat/browser/chatPetService.ts, src/vs/workbench/contrib/chat/test/browser/widget/chatPetWidget.test.ts и этот отчёт. Constructor DI compatibility сохранить; данные/цвета/локальное состояние не менять. Shared entrypoints/GitHub исключены.

Код: `05ac1895fe2`. Удалены event/classification types, startup/change logging и helper. Telemetry DI parameter оставлен как unused compatibility argument для существующих constructor callers; никаких вызовов telemetry нет.

Проверки: 2 browser tests (no enablement logs; scale/position persistence across windows/restart) passed; ESLint 2 files passed; targeted TypeScript 2 files 0 diagnostics; git diff --check passed. Полный widget suite не запускался, общая сборка интегратором. Локальное состояние и его синхронизация сохранены.

Интегратору: принять ветку, wiring не требуется. Это удаление конкретного telemetry producer, не всего ChatPetService.
