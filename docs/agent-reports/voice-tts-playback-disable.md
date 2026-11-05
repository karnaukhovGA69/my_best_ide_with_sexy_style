# voice-tts-playback-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее voice-session-controller-disable. Ветка: `agent/voice-tts-playback-disable`. База: `670cc65fce4` (актуальный main после релиза 0.0.8).

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/ttsPlaybackService.ts`, новый `src/vs/workbench/contrib/chat/test/browser/voiceClient/ttsPlaybackService.test.ts` и этот отчёт. Не назначать второго владельца этих файлов.

A06: удалить audio context/decode/buffer/source/analyser/playback lifecycle и хранение samples в голосовом TTS service. Сохранить interface/decorator/singleton как неактивный adapter; ensureContext явно отказывает. Не менять общий accessibility/speech API, mic capture, UI, entrypoints, MCP/documents, Terminal/Tasks или зависимости. Предыдущие задачи уже включены интегратором в 0.0.8; их повторно не переносить. Полная сборка за интегратором.
