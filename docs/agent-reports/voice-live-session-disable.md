# voice-live-session-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее ai-terminal-cleanup-refresh. Ветка: `agent/voice-live-session-disable`. База: `59f0fde52ec` (main). Предыдущая терминальная task-ветка сохранена отдельно и ожидает integration.

Зарезервировано до реализации: `src/vs/workbench/contrib/speech/browser/speechService.ts`, `src/vs/workbench/contrib/speech/test/browser/voiceLiveSession.test.ts`, новые целевые тесты speech в том же test/browser каталоге и этот отчёт. Не назначать второго владельца этих файлов.

Задание из A06 project-plan: отключить оставшийся мост голосовых AI live sessions без активации onSpeech, вызова провайдера или удержания provider объекта; сохранить сигнатуры и disposable регистрацию для совместимости. Обычные speech-to-text/text-to-speech/keyword providers и accessibility инфраструктуру не удалять без отдельного аудита. MCP, documents/PDF, terminal, API bridge/protocol, общие entrypoints, package/build/lockfiles не менять. Полная сборка/релиз остаются integration.
