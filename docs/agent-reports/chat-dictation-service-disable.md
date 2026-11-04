# chat-dictation-service-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее voice-transcription-transport-disable. Ветка: `agent/chat-dictation-service-disable`. База: `59f0fde52ec` (main).

Зарезервировано до реализации: `src/vs/workbench/contrib/chat/browser/speechToText/chatSpeechToTextService.ts`, `src/vs/workbench/contrib/chat/test/browser/chatSpeechToTextService.test.ts`, этот отчёт. Не назначать второго владельца этих файлов.

Задание A06/P01: заменить встроенный сервис диктовки совместимым недоступным сервисом; убрать mic/audio capture, auth/config/entitlement listeners, local/cloud model startup, LLM cleanup и метрики. Сохранить интерфейс и exports, проверить внешних consumers. Не менять общий SpeechService/API, transport из предыдущего патча, общие entrypoints/DI registration, настройки, mic UI, MCP, documents/PDF, Terminal/Tasks, build/package/lockfiles. Полная сборка/релиз остаются интегратору.
