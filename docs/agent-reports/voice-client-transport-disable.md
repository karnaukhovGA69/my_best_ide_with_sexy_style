# voice-client-transport-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее voice-tool-dispatch-disable. Ветка: `agent/voice-client-transport-disable`. База: `59f0fde52ec` (main).

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceClientService.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceClientService.test.ts` и этот отчёт. Не назначать второго владельца этих файлов.

A06: удалить голосовой WebSocket/WebRTC transport, provider availability/SDP, reconnect/ping timers, audio/context/tool/feedback outbound paths. Сохранить общий интерфейс и singleton как неактивный adapter, экспортируемый pure language helper; подключения отказывать явно. Не менять voiceSessionController, mic/tts сервисы, common контракты, общие entrypoints, MCP/documents, Terminal/Tasks и зависимости. Полная сборка за интегратором.
