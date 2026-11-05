# voice-mic-capture-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее voice-tts-playback-disable. Ветка: `agent/voice-mic-capture-disable`. База: `81efa000a9f` (актуальный main).

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/micCaptureService.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/micCaptureService.test.ts` и этот отчёт. Не назначать второго владельца этих файлов.

A06: удалить getUserMedia/audio context/worklet/capture/diagnostics/timers и storage/notifications из MicCaptureService. Сохранить interface/decorator/singleton, constants и exported helpers; acquisition явно отказывает, release/control inert. Не менять shared PCM worklet, общие speech/accessibility API, UI, TTS область предыдущей ветки, MCP/documents, Terminal/Tasks или зависимости. Полная сборка за интегратором.
