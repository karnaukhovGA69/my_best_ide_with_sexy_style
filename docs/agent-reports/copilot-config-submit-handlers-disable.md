# copilot-config-submit-handlers-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/copilot-config-submit-handlers-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить Copilot config slash submit interception из editor и Sessions. Область: workbench/contrib/chat/browser/agentSessions/agentHost/copilotConfigSlashSubmitHandler.ts и соответствующий test/browser/agentSessions/copilotConfigSlashSubmitHandler.test.ts; sessions/contrib/chat/browser/copilotConfigSlashSubmitHandler.ts и test/browser/copilotConfigSlashSubmitHandler.test.ts (новый); этот отчёт. Сохранить contribution IDs и общую submit API. Wrapper resolver удалить после проверки consumers; общие parser/config APIs, permissions/approval механизмы, данные, auth и shared entrypoints не менять.
