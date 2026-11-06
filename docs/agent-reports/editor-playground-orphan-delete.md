# editor-playground-orphan-delete

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/editor-playground-orphan-delete. База: eab8fa4a00d3ad7911a0431fa0fe051320affb90.

U10: удалить физически реализации уже отключённого Editor Playground. Область (до правок):
- `src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughActions.ts`
- `src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughPart.ts`
- `src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughInput.ts`
- `src/vs/workbench/contrib/welcomeWalkthrough/common/walkThroughUtils.ts`
- `src/vs/workbench/contrib/welcomeWalkthrough/common/walkThroughContentProvider.ts`
- `src/vs/workbench/contrib/welcomeWalkthrough/browser/editor/editorWalkThrough.ts`
- `src/vs/workbench/contrib/welcomeWalkthrough/browser/editor/vs_code_editor_walkthrough.ts`
- `src/vs/workbench/contrib/welcomeWalkthrough/browser/media/walkThroughPart.css`

И этот отчёт. Inert contribution и regression tests сохраняются. Export/module reference scan: рабочие ссылки только внутри удаляемого набора; одноимённая функция moduleToContent в welcomeGettingStarted самостоятельная и не меняется. Исторические perf/URI fixtures сохраняются. Общие entrypoints/GitHub/другие агенты исключены.

Код: `77c7d379bbd`. Физически удалены 8 файлов, 1285 строк: editor/input/provider/actions/content/theme/CSS. Инертный contribution и 3 regression tests сохранены.

Проверки: 3 browser regression tests passed; module/export reference scan до удаления подтверждает замкнутый набор; после удаления module names не встречаются в src/test/build кроме исторических URI/perf fixtures. git diff --check passed. Новых тестов на отсутствие файлов, full typecheck/package не запускал. Ничего не меняется в Welcome/Get Started, языковых возможностях редактора или extension API. Интегратору wiring не требуется, исходная регистрация уже удалена в main.
