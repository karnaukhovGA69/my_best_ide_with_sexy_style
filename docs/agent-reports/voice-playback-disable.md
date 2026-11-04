# voice-playback-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее chat-dictation-service-disable. Ветка: `agent/voice-playback-disable`. База: `59f0fde52ec` (main).

Зарезервировано до реализации: `src/vs/workbench/contrib/chat/common/voicePlaybackService.ts`, новый `src/vs/workbench/contrib/chat/test/common/voicePlaybackService.test.ts`, этот отчёт. Не назначать второго владельца этих файлов.

Задание A06/A03: убрать хранение транскриптов и voice playback state, replay/stop dispatch, регистрацию notifyStart/notifyEnd bridge commands; оставить совместимый неактивный сервис и delayed DI для Chat/Sessions consumers. Не менять VoiceChatService, SpeechService, UI/общие entrypoints, MCP, documents/PDF, Terminal/Tasks, API, зависимости/build. Полная сборка и релиз остаются интегратору.
