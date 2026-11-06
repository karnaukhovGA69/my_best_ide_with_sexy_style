# chat-utility-model-requests-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-utility-model-requests-disable. База: 9af08a3006d28d080e26beb94ae1ad9f117d1b60.

P02: удалить core utility AI request execution/background queue/cache/backoff/logging. Область: src/vs/workbench/contrib/chat/common/chatUtilityModelService.ts и test/common/chatUtilityModelService.test.ts, этот отчёт. Сохранить DI/service/request contracts, sendRequest возвращает undefined. Историю/общий language-model extension API/GitHub authorization/shared entrypoints не менять.

Код: `cd44ba22bb4`. Удалены model request execution/stream collection, queue/dedup, cancellation listeners, timeout/backoff и logging. sendRequest сохраняет Promise<string | undefined> и возвращает undefined без чтения request/token; общий language-model API не меняется.

Проверки: 2 service browser tests + 2 targeted chatThinkingContentPart history/fallback tests; ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Full typecheck/build/package — интегратор. Подключений нет.
