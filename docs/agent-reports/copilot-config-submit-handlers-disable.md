# copilot-config-submit-handlers-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/copilot-config-submit-handlers-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить Copilot config slash submit interception из editor и Sessions. Область: workbench/contrib/chat/browser/agentSessions/agentHost/copilotConfigSlashSubmitHandler.ts и соответствующий test/browser/agentSessions/copilotConfigSlashSubmitHandler.test.ts; sessions/contrib/chat/browser/copilotConfigSlashSubmitHandler.ts и test/browser/copilotConfigSlashSubmitHandler.test.ts (новый); этот отчёт. Сохранить contribution IDs и общую submit API. Wrapper resolver удалить после проверки consumers; общие parser/config APIs, permissions/approval механизмы, данные, auth и shared entrypoints не менять.

Удалены обе регистрации submit handlers и автоматическое применение Copilot config из slash-команд. Wrapper resolveCopilotConfigSlashSubmit/его interface удалены как локальные orphan exports: внешних consumers нет. Общие parsers, config/permissions APIs и диалоги не менялись. Код: 0f1b1e1c0aa.

Проверки: 2 browser tests — strict DI без submit/session/config/dialog/storage services; ESLint — 4 файла; узкие TypeScript diagnostics — 4 файла, 0 ошибок; git diff --check. Shared entrypoints сохранены, вклад классов инертный. Полные build/package/native smoke не запускались.
