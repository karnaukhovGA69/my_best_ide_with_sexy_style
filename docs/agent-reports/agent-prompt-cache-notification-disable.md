# agent-prompt-cache-notification-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/agent-prompt-cache-notification-disable. База: a483b299cd519d10267b480c0352a8ce7feafe12.

P02: удалить prompt-cache expiry experiment/notification tracking. Область: src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostPromptCacheNotification.ts и test/browser/agentSessions/agentHostPromptCacheNotification.test.ts, этот отчёт. Сохранить trackSession contract без observers/timers. История/операционные сессии/GitHub authorization/shared entrypoints не меняются.

Код: `60655d47b86`. Удалены experiment fetch, registration command, storage writes, notification UI, session observers и expiry schedulers. trackSession возвращает Disposable.None и не читает session resource/subscription.

Проверки: 1 browser test (strict empty DI/unreadable sessions/нет новых команд); ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Full typecheck/build/package — интегратор. Подключений нет.
