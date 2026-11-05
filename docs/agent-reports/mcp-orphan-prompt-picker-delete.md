# mcp-orphan-prompt-picker-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-prompt-picker-delete`. База: `98aa2b043b1`. Claim: `54adc7c267b`. Код: `cd81b430646aa417b257e1cbc5e18e1d4ef67fa9`.

Полностью удалены `src/vs/workbench/contrib/mcp/browser/mcpPromptArgumentPick.ts` и соответствующий `test/browser/mcpPromptArgumentPick.test.ts`: 73 строки фасада и его тестов. Последний production caller был удалён задачей mcp-chat-prompt-action-remove, уже вошедшей в базу. В src/extensions/build больше нет ссылок на модуль или класс.

Проверки: 75 browser tests chatInputCompletions прошли; git diff --check прошёл. Новых/изменённых TS-файлов нет, повторный lint/typecheck не требуется. Полный build/package выполняет интегратор на пакете. Другие MCP реализации ещё остаются. GitHub/auth/Git/SSH и чужие области не менялись. Дополнительных подключений нет.
