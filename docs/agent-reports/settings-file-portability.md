# settings-file-portability

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/settings-file-portability. База: main 98aa2b043b1.

Новое прямое решение пользователя: перенос настроек локальным файлом вместо GitHub OAuth/catalog/backup. Область: новые src/vs/workbench/contrib/settingsTransfer/common/**, browser/**, test/** и этот отчёт. Реализовать JSON/JSONC export/import текущего профиля, видимые меню, предварительный diff и отдельное Apply, сохранение остальных настроек и защиту от перезаписи изменившегося/грязного settings.json. SecretStorage/токены не читаются, чувствительные/непереносимые настройки исключаются. Полные сборки/релизы не запускать; одно подключение нового contribution entrypoint передать интегратору.

GitHub runtime удаляет отдельно назначенный владелец. Общие планы/AGENTS/build/allowlist, MCP/voice/documents/inline/walkthrough не входят в эту задачу. Предыдущие готовые ветки: agent/log-session-budget и agent/inline-completions-runtime-disable опубликованы.
