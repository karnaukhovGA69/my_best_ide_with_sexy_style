# session-picker-orphan-payload-delete

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/session-picker-orphan-payload-delete. База: 8a9f66bc9af61dfa3a8e4648fd1989392f79a2d4 + собственные готовые model-picker-tryout-disable a4867f04181 и session-picker-tryout-disable 08cb713081796dc615d059404969201159e3787d. Merge только в собственном worktree.

Область: src/vs/workbench/contrib/chat/common/onboarding/newSessionPickerTryout.ts и этот отчёт. Удалить orphan payload type/guard/presentation kind после проверки references. Остальные shared onboarding definitions/entrypoints/GitHub authorization исключены.

Код: `a9c4bf3537c`. После объединения 2 готовых зависимостей без конфликтов reference scan всех exported symbols/module path выявил только удаляемый файл. Payload/guard/kind физически удалены; git diff --cached --check passed. Runtime consumers нет, новые тесты/full typecheck/package не запускались. Ветка включает обе dependencies, принимать head или deletion commit после них; wiring не требуется.
