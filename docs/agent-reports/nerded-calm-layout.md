# nerded-calm-layout

Статус: ЗАНЯТО. Владелец: visual implementation. Ветка: agent/nerded-calm-layout. База: 9d20e5acad9f5306e090213e2258b3756bf679a3.

Задача: геометрия Calmer Studio по docs/nerded-code-visual-spec.md; тема и полные иконки готовы отдельно в agent/nerded-calm-theme-icons.

Точная область: src/vs/workbench/contrib/modernUI/browser/calmerStudio.ts, media/calmerStudio.css, modernUI.contribution.ts (только import локального contribution), README.md; src/vs/workbench/services/layout/browser/layoutService.ts (setting/helper/metrics без изменения DI interface); src/vs/workbench/browser/parts/titlebar/titlebarPart.ts, statusbar/statusbarPart.ts, editor/editorTabsControl.ts; src/vs/workbench/contrib/files/browser/views/explorerViewer.ts и explorerView.ts (только row heights/обновление геометрии); соответствующие новые calmerStudio*.test.ts в modernUI/test/browser; этот отчёт. Нужное расширение точного списка заранее записать. Общие entrypoints/product/build/defaults и appearanceActions.ts, бренд/иконка приложения остаются интегратору.

План: отдельная конфигурация и класс Calmer, штатный flush layout без floating/connected/pill/glass, согласованные реальные JS/CSS размеры title/tabs/status/file rows, небольшие радиусы и focus из theme tokens. Классы на основных/дополнительных окнах, снятие при смене режима/dispose. Использовать существующие layout/persistence/resize; не создавать имитацию IDE. Native overall smoke и применение полного пресета в меню/новом профиле — интегратором.

Проверки: targeted browser unit + реальный CSS/computed geometry, theme independence/HC/reduced motion, обратимое переключение, lint и selected diagnostics; без отдельной полной сборки.

Расширение точного scope перед правками: src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts — только передача configuration service новому параметру базового EditorTabsControl. Нужен штатный config listener для согласованной JS/CSS высоты вкладок при переключении, без MutationObserver/polling.
