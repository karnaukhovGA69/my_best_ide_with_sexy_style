# chat-orphan-spotlight-delete

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-orphan-spotlight-delete. База: 8a9f66bc9af61dfa3a8e4648fd1989392f79a2d4.

A06: удалить неиспользуемый chat input spotlight tour. Область: src/vs/workbench/contrib/chat/browser/onboarding/chatInputSpotlightTour.ts и src/vs/workbench/contrib/chat/test/browser/onboarding/chatInputSpotlightTour.test.ts, этот отчёт. Module/export names reference scan на src/test/build до удаления подтверждает замкнутый набор; нет production consumers. General onboarding infrastructure/eligibility и GitHub authorization/shared entrypoints исключены.

Код: `1c1ec98f4dc`. Удалены orphan tour scenario/target resolution/timers/contribution и obsolete tests. Проверки: module/export reference scan до удаления только 2 файла; git diff --cached --check passed. Runtime consumers не было, новые тесты/full typecheck/package не запускались. Wiring не требуется.
