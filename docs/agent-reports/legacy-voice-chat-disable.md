# legacy-voice-chat-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее voice-playback-disable. Ветка: `agent/legacy-voice-chat-disable`. База: `59f0fde52ec` (main).

Зарезервировано до реализации: `src/vs/workbench/contrib/chat/common/voiceChatService.ts`, `src/vs/workbench/contrib/chat/test/common/voiceChatService.test.ts`, `src/vs/workbench/contrib/chat/electron-browser/actions/voiceChatActions.ts`, `src/vs/workbench/contrib/chat/test/electron-browser/actions/voiceChatActions.test.ts`, этот отчёт. Не назначать второго владельца этих файлов.

A06/A02: убрать запуск speech providers и преобразование речи в agent/slash-команды через VoiceChatService; сохранить контракт с явным отказом. В caller исправить освобождение сессии и GettingReady state при rejected startup. Не менять общий SpeechService/API, новый voiceClient/controller, прошлые dictation/playback задачи, MCP, documents/PDF, Terminal/Tasks, общие entrypoints/build/dependencies. Полная сборка и релиз остаются integration.
