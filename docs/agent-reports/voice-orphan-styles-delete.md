# voice-orphan-styles-delete

Статус: ГОТОВО к интеграции. Код: `13ba1b32389`. Владелец: voice cleanup. Ветка: `agent/voice-orphan-styles-delete`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: удалить пять orphan CSS после integrated dictation-onboarding/editor-session/input-mode/affordance removal. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/media/dictationSession.css`, `src/vs/workbench/contrib/chat/browser/speechToText/media/dictationOnboarding.css`, `src/vs/workbench/contrib/chat/browser/voiceInputMode/media/voiceInputMode.css`, `src/vs/workbench/contrib/chat/browser/voiceClient/media/voiceInputDecorations.css`, `src/vs/workbench/contrib/codeEditor/browser/dictation/editorDictation.css` и этот отчёт. Runtime imports отсутствуют; editorDictation.css упомянут только как строка URI perf fixture, этот dataset не менять. Другие voice CSS ещё имеют callers и исключены. Shared entrypoints/build/common styles/Git/SSH/auth/history не менять.

Удалены пять CSS, 442 строки. Runtime уже удалён предыдущими integrated задачами. Другие stylesheet imports, общие theme tokens/стили и URI perf dataset сохранены.

Проверки: перед удалением verified main ancestry `19717002b36`, `c696a00465b`, `27d7289bff3`, `59a0628955c`; reference scan src/test/build после удаления — 0 вне исторических строк uri.perf.data.txt; git diff --check passed. Runtime и tests не менялись, повторный browser/typecheck/full build не запускался. Общий resource/package check у интегратора.

Интегратору: код и отчёт с ветки. Нужные runtime изменения уже входят в базу. Shared entrypoints/build/main/данные пользователя не менялись. dictationMicGlow.css и voiceGlow.css пока имеют imports в main, поэтому здесь не удаляются.
