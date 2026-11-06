# chat-transfer-auto-trust-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-transfer-auto-trust-disable. База: 15520b78a5ddecc52a1d610a61f7c0c397b578e0.

P02 / сохранение Workspace Trust. Область: chat/browser/actions/chatTransfer.ts; chat/common/model/chatTransferService.ts; новый chat/test/browser/actions/chatTransfer.test.ts; этот отчёт. Удалить startup вызов и AI transfer auto-grant trust, новые AI transfer storage markers. Экспортированные service/ID/methods оставить инертными для consumers. Старые storage keys не удалять; общий Workspace Trust, ручное подтверждение, workspace services и shared registration не менять.

Реализация: 4624973430a. Удалены startup invocation, проверка transferred/empty workspace с автоматическим setWorkspaceTrust(true), новые markers и удаление старых markers. Service/methods/ID совместимы и инертны; старый storage остаётся нетронутым.

Проверки: 2 strict-DI browser regressions без failures/page errors: startup не активирует transfer service; вызовы API не активируют trust/file services и не меняют старые transfer data. Lint и выбранные TS diagnostics 3 файлов, diff --check — без ошибок. Настройки и ручной Workspace Trust не менялись; native untrusted-workspace smoke общего пакета по-прежнему обязателен интегратору.
