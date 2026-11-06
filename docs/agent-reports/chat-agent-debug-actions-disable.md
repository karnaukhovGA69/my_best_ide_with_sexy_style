# chat-agent-debug-actions-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-agent-debug-actions-disable. База: 0fb7ca8b62c132f6ca88d3923a1e5d0b2a43511c.

P02: удалить регистрацию и реализацию четырёх AI Agent Debug Logs actions (open/session/export/import), включая analytics. Область: chat/browser/actions/chatOpenAgentDebugPanelAction.ts; chat/test/browser/actions/chatOpenAgentDebugPanelAction.test.ts (новый); этот отчёт. Сохранить совместимый registration entrypoint. Обычный debugger, log files/data storage, auth/catalog и shared entrypoints не менять.

Дополнение области до правки: chat/browser/attachments/chatAttachmentWidgets.ts — только click handler для attachment.kind === debugEvents, который вызывает удаляемую команду. Удалить неработающий переход; данные и отображение вложения оставить. Других потребителей этих command IDs поиск по src не обнаружил.

Удалены регистрации/меню/handlers четырёх AI debug actions, связанные telemetry и debugEvents attachment click handler. Совместимая функция регистрации — no-op; обычный debugger и содержимое локальных логов/вложений не менялись. Код: 8358375d149.

Проверки: 1 browser test (повторная регистрация оставляет 4 команды отсутствующими); ESLint — 3 файла; узкие TypeScript diagnostics — 3 файла, 0 ошибок; git diff --check. Поиск удалённых command IDs по src не нашёл оставшихся production callers. Полные build/package/native smoke не запускались; shared entrypoints не менялись.
