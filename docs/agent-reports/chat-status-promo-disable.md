# chat-status-promo-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-status-promo-disable. База: 9be3b2c89dcbbb932398794f2f8d18a022fb398f.

P02/A06: удалить рекламные предложения моделей в строке состояния. Область: src/vs/workbench/contrib/chat/browser/chatStatus/chatStatusPromo.ts и test/browser/chatStatusPromo.test.ts, этот отчёт. Shared entrypoints, GitHub authorization и история исключены.

Код: `c994a69d999`. Удалены experiment enrollment, model scan, storage/listeners, promotional command, tooltip, telemetry. Оставлен совместимый inert surface без DI; getEntryProps всегда undefined.

Проверки: 1 browser regression test, ESLint двух файлов, selected-file semantic types (0 diagnostics), git diff --check — passed. Общая сборка/typecheck/package — интегратор. Merge ветки, дополнительные подключения не нужны.
