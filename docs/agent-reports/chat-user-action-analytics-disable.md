# chat-user-action-analytics-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-user-action-analytics-disable. База: 9be3b2c89dcbbb932398794f2f8d18a022fb398f.

P02/A07: удалить user action/followup analytics. Область: src/vs/workbench/contrib/chat/common/chatService/chatServiceTelemetry.ts — только ChatServiceTelemetry и его private event types/imports; test/common/chatService/chatService.test.ts — тест user action telemetry; этот отчёт. ChatRequestTelemetry/session identity helpers/реальные действия и история/GitHub authorization/shared entrypoints не меняются.
