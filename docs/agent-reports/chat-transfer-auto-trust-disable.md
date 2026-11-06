# chat-transfer-auto-trust-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-transfer-auto-trust-disable. База: 15520b78a5ddecc52a1d610a61f7c0c397b578e0.

P02 / сохранение Workspace Trust. Область: chat/browser/actions/chatTransfer.ts; chat/common/model/chatTransferService.ts; новый chat/test/browser/actions/chatTransfer.test.ts; этот отчёт. Удалить startup вызов и AI transfer auto-grant trust, новые AI transfer storage markers. Экспортированные service/ID/methods оставить инертными для consumers. Старые storage keys не удалять; общий Workspace Trust, ручное подтверждение, workspace services и shared registration не менять.
