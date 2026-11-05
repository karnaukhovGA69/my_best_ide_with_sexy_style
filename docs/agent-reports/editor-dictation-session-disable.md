# editor-dictation-session-disable

Статус: ГОТОВО к интеграции. Код и тесты: `59a0628955c`. Владелец: voice cleanup. Ветка: `agent/editor-dictation-session-disable`. База: `62f2cc32a7cfd017f9fb2e1d65ae22296a0bd674`.

A06: убрать editor dictation contribution/actions/provider dispatch и общий dictation session/transcript insertion runtime. До правок зарезервированы `src/vs/workbench/contrib/codeEditor/browser/dictation/editorDictation.ts`, `src/vs/workbench/contrib/codeEditor/test/browser/editorDictation.test.ts`, `src/vs/workbench/contrib/chat/browser/speechToText/dictationSession.ts`, `src/vs/workbench/contrib/chat/test/browser/dictationSession.test.ts` и этот отчёт. Сохранить exported contracts для chat/SCM/comments callers. Общие speech/accessibility/extension API, Git/SSH/auth, shared entrypoints, настройки/история и чужие задачи исключены.

Удалены editor dictation contribution/command registrations, toolbar widget, speech-provider dispatch, editor mutations, cancellation/timers/subscriptions и shared transcript inserter/session state. Сохранены action IDs и неактивный EditorDictation adapter для explicit SCM/comment contribution lists; get возвращает null, start/stop не читают editor/services. Shared session API возвращает false/undefined/Event.None и ничего не изменяет. Неиспользуемый DictationWidget удалён, внешних consumers не найдено.

Проверки: 5 browser tests passed; targeted ESLint 4 файлов passed; semantic/syntactic TypeScript 4 файлов — 0; git diff --check passed. Проверены отсутствие registrations, strict DI, unreadable editor/services/window, все surfaces, concurrent lifecycle, отсутствие events/timers, сохранность model/selection/decorations и ручной type command. ESBuild/Playwright runner, не full/native build; зависимости неизменны, pnpm skills warning.

Интегратору: `59a0628955c` и отчёт. Проверить SCM/comment inputs и обычный editor typing в общем smoke. Сохранён class constructor(editor) для lazy explicit contributions. Common speech/extension/accessibility API, Git/SSH/auth, пользовательские настройки/история, shared entrypoints/main/build не менялись. CSS/assets остаются отдельно.
