# dictation-orphan-language-delete

Статус: ГОТОВО к интеграции. Код: `cb2b0e87a6f`. Владелец: voice cleanup. Ветка: `agent/dictation-orphan-language-delete`. База: `411cccde06e843fac42e170ccf749f7784c7f7e3`.

A06: удалить невостребованный resolver локали удалённого Nemotron dictation backend. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/dictationLanguage.ts`, `src/vs/workbench/contrib/chat/test/browser/chatSpeechToTextService.test.ts` и этот отчёт. Reference scan находит только сам module и один obsolete test case. Остальные service regressions/compatibility tests сохранить; app language/localization/common API/Git/SSH/auth/shared entrypoints не менять.

Удалены dictationLanguage.ts и единственный obsolete test case/import. Оставлены все остальные unavailable-service и compatibility regressions; общая локализация приложения не менялась.

Проверки: reference scan resolver/module — 0; оставшиеся 18 chatSpeechToTextService browser tests passed; targeted ESLint теста passed; semantic/syntactic TypeScript теста — 0; git diff --check passed. ESBuild/Playwright runner, без full/native build; dependencies неизменны.

Интегратору: код и отчёт с ветки. База содержит disabled ChatSpeechToTextService; production imports resolver отсутствовали ещё до удаления. Common localization/settings/Git/SSH/auth/API/main/build не менялись.
