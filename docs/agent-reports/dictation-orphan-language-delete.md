# dictation-orphan-language-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/dictation-orphan-language-delete`. База: `411cccde06e843fac42e170ccf749f7784c7f7e3`.

A06: удалить невостребованный resolver локали удалённого Nemotron dictation backend. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/dictationLanguage.ts`, `src/vs/workbench/contrib/chat/test/browser/chatSpeechToTextService.test.ts` и этот отчёт. Reference scan находит только сам module и один obsolete test case. Остальные service regressions/compatibility tests сохранить; app language/localization/common API/Git/SSH/auth/shared entrypoints не менять.
