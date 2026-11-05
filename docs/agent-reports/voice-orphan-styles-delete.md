# voice-orphan-styles-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/voice-orphan-styles-delete`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: удалить пять orphan CSS после integrated dictation-onboarding/editor-session/input-mode/affordance removal. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/media/dictationSession.css`, `src/vs/workbench/contrib/chat/browser/speechToText/media/dictationOnboarding.css`, `src/vs/workbench/contrib/chat/browser/voiceInputMode/media/voiceInputMode.css`, `src/vs/workbench/contrib/chat/browser/voiceClient/media/voiceInputDecorations.css`, `src/vs/workbench/contrib/codeEditor/browser/dictation/editorDictation.css` и этот отчёт. Runtime imports отсутствуют; editorDictation.css упомянут только как строка URI perf fixture, этот dataset не менять. Другие voice CSS ещё имеют callers и исключены. Shared entrypoints/build/common styles/Git/SSH/auth/history не менять.
