# editor-dictation-session-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/editor-dictation-session-disable`. База: `62f2cc32a7cfd017f9fb2e1d65ae22296a0bd674`.

A06: убрать editor dictation contribution/actions/provider dispatch и общий dictation session/transcript insertion runtime. До правок зарезервированы `src/vs/workbench/contrib/codeEditor/browser/dictation/editorDictation.ts`, `src/vs/workbench/contrib/codeEditor/test/browser/editorDictation.test.ts`, `src/vs/workbench/contrib/chat/browser/speechToText/dictationSession.ts`, `src/vs/workbench/contrib/chat/test/browser/dictationSession.test.ts` и этот отчёт. Сохранить exported contracts для chat/SCM/comments callers. Общие speech/accessibility/extension API, Git/SSH/auth, shared entrypoints, настройки/история и чужие задачи исключены.
