# voice-transcription-transport-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее voice-live-session-disable и ai-terminal-cleanup-refresh. Ветка: `agent/voice-transcription-transport-disable`. База: `59f0fde52ec` (main).

Зарезервировано до реализации: `src/vs/workbench/contrib/chat/browser/speechToText/voiceCodeTranscriptionClient.ts`, `src/vs/workbench/contrib/chat/test/browser/speechToText/voiceCodeTranscriptionClient.test.ts`, этот отчёт. Не назначать второго владельца этих файлов.

A06 project-plan: убрать WebSocket transport, отправку аудио, connection/session/ping timers и разбор ответов AI transcription из этого клиента, оставив совместимый недоступный сервис. Проверить реальные callers и DI. Не менять chatSpeechToTextService, mic capture, SpeechService, общие entrypoints/регистрации, MCP, documents, terminal, API, dependencies/build. Полный релизный цикл остаётся интегратору.
