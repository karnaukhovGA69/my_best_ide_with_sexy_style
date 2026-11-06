# chat-followup-renderer-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-followup-renderer-disable. База: 2fc70ec91af871193f043498b52479518ffbc81e.

A02: убрать suggested followup buttons renderer. Область: src/vs/workbench/contrib/chat/browser/widget/input/chatFollowups.ts и новый test/browser/widget/input/chatFollowups.test.ts относительно contrib/chat; этот отчёт. Constructor/generic type сохранить для chatInputPart. Не менять историю/общие chat APIs/GitHub authorization/shared entrypoints.

Код: `7cc1f3b569b`. Удалены followup parsing/buttons/agent lookup/click handlers. Compatibility constructor не читает followups/options, не меняет container и не вызывает callbacks. 1 browser test passed; lint 2 files passed; targeted types 2 files 0 diagnostics; diff --check passed. Full проверки интегратором.
