# inline-completions-service-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/inline-completions-service-disable. База: main b73001809cd, уже включает inline-completions-runtime-disable.

Область: src/vs/editor/browser/services/inlineCompletionsService.ts, новый src/vs/editor/test/browser/services/inlineCompletionsService.test.ts и отчёт. После снятия runtime registrations удалить теперь неиспользуемые snooze actions, DI telemetry/contextkey dependencies, таймеры и хранение completion IDs. Сохранить IInlineCompletionsService/decorator/class/method signatures как неактивный compatibility adapter для существующих Chat/model consumers; обычный IntelliSense не менять. Целевые проверки strict DI, отсутствие таймеров/событий/аналитики, регистрация API и оставшиеся consumers. Общие build/deps/main и другие активные области не менять.
