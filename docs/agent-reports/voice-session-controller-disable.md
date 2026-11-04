# voice-session-controller-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее voice-client-transport-disable. Ветка: `agent/voice-session-controller-disable`. База: `59f0fde52ec` (main).

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceSessionController.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceSessionController.test.ts` и этот отчёт. Не назначать второго владельца этих файлов.

A06/A02: удалить runtime voice controller — audio/mic/auth/transcripts/telemetry/session dispatch/confirmations/listeners/timers/replay commands. Сохранить интерфейс, singleton registration и exported pure helpers; controller остаётся явно неактивным совместимым adapter. Не менять mic/tts, auth implementation, transcript storage, общие entrypoints, UI host files, MCP/documents, Terminal/Tasks или зависимости. Полная сборка за интегратором.
