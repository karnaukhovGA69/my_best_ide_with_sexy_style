# dictation-indicators-disable

Статус: ГОТОВО к интеграции. Код и тесты: `f77e9408362`. Владелец: voice cleanup. Ветка: `agent/dictation-indicators-disable`. База: `98aa2b043b141e7b4cc74d8f8d5e38da41bf68d7`.

A06: убрать dictation microphone glow subscriptions/animation и download-ring SVG/progress subscriptions. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/dictationMicGlow.ts`, `src/vs/workbench/contrib/chat/browser/speechToText/dictationDownloadRing.ts`, `src/vs/workbench/contrib/chat/test/browser/dictationMicGlow.test.ts`, `src/vs/workbench/contrib/chat/test/browser/dictationDownloadRing.test.ts` и этот отчёт. Сохранить pure helpers/contracts; unavailable labels вместо ложного downloading/connecting. Shared entrypoints, GitHub/auth/Git/SSH, common API, настройки/история и чужие задачи исключены.

Удалены microphone glow DOM/style mutations, analyser reads, service/theme/accessibility/observable subscriptions и animation loop; setup возвращает Disposable.None. Download ring больше не создаёт SVG и не наблюдает progress. Hover/label честно сообщают о недоступной диктовке, не читают backend/progress. Pure glow easing/phase/color helpers сохранены.

Проверки: 6 browser tests passed (3 сохранённых pure helpers); targeted ESLint 4 файлов passed; semantic/syntactic TypeScript 4 файлов — 0; git diff --check passed. Исправлены assertions MarkdownString.isTrusted=false; в follow-up `72d954cada7` заменён restricted in-operator на structural deepStrictEqual hover. После follow-up повторно прошли 6 browser tests и lint теста; semantic check предыдущей версии 0, product runtime не менялся. Проверены unreadable inputs/services, неизменность DOM/styles, repeated update/disposal и unavailable labels. ESBuild/Playwright runner, без full/native build; зависимости неизменны.

Интегратору: код и отчёт с ветки; wiring не требуется. Проверить toolbar/input в общем smoke. Shared entrypoints/CSS/assets, GitHub/auth/Git/SSH/common API/main/build не менялись.
