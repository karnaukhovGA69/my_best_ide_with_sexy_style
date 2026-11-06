# nerded-calm-layout

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: visual implementation. Ветка: agent/nerded-calm-layout. База: 9d20e5acad9f5306e090213e2258b3756bf679a3.

Задача: геометрия Calmer Studio по docs/nerded-code-visual-spec.md; тема и полные иконки готовы отдельно в agent/nerded-calm-theme-icons.

Точная область: src/vs/workbench/contrib/modernUI/browser/calmerStudio.ts, media/calmerStudio.css, modernUI.contribution.ts (только import локального contribution), README.md; src/vs/workbench/services/layout/browser/layoutService.ts (setting/helper/metrics без изменения DI interface); src/vs/workbench/browser/parts/titlebar/titlebarPart.ts, statusbar/statusbarPart.ts, editor/editorTabsControl.ts; src/vs/workbench/contrib/files/browser/views/explorerViewer.ts и explorerView.ts (только row heights/обновление геометрии); соответствующие новые calmerStudio*.test.ts в modernUI/test/browser; этот отчёт. Нужное расширение точного списка заранее записать. Общие entrypoints/product/build/defaults и appearanceActions.ts, бренд/иконка приложения остаются интегратору.

План: отдельная конфигурация и класс Calmer, штатный flush layout без floating/connected/pill/glass, согласованные реальные JS/CSS размеры title/tabs/status/file rows, небольшие радиусы и focus из theme tokens. Классы на основных/дополнительных окнах, снятие при смене режима/dispose. Использовать существующие layout/persistence/resize; не создавать имитацию IDE. Native overall smoke и применение полного пресета в меню/новом профиле — интегратором.

Проверки: targeted browser unit + реальный CSS/computed geometry, theme independence/HC/reduced motion, обратимое переключение, lint и selected diagnostics; без отдельной полной сборки.

Расширение точного scope перед правками: src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts — только передача configuration service новому параметру базового EditorTabsControl. Нужен штатный config listener для согласованной JS/CSS высоты вкладок при переключении, без MutationObserver/polling.

Дополнение scope перед правкой: src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts — macOS override minimumHeight должен делегировать Calmer в BrowserTitlebarPart, иначе выбранные 48px не применяются в целевой desktop платформе. Native window control rendering/branding не менять.

Тест native override располагается отдельно: src/vs/workbench/contrib/modernUI/test/electron-browser/calmerStudio.test.ts, чтобы browser-тесты не импортировали electron-browser слой.


Результат: отдельный `workbench.calmerStudio` (default false), helper `isCalmerStudio`, CSS class `calmer-studio` и BlockRestore contribution. Calmer активен при true + `workbench.experimental.modernUI=false`; если обе настройки true, Modern явно побеждает. Конфигурация автоматически не переписывается. Contribution переключает основной/дополнительные контейнеры, вызывает штатный layout только при изменении активного режима и очищает свой class при dispose.

Calmer использует классический flush grid без floating/connected/pill/glass. Настоящие layout constraints: titlebar 48px (включая macOS NativeTitlebarPart override), tab 44px / пользовательский compact 32px, statusbar 32px, Explorer row 30px. Нативная zoom/WCO ветка заголовка сохранена. При переключении обновляются виртуальные высоты загруженных строк дерева и padding, CSS variable штатных вкладок, события ограничений title/status; основной механизм resize/persistence не заменяется. Вкладки обновляют высоту микрозадачей после конфигурационного события, чтобы обработчик Modern успел обновить свои классы; после dispose отложенная работа не выполняется. Новых idle timers/processes/network нет.

CSS использует theme-independent scoped geometry и существующие corner tokens. Небольшие controls 4px/menu 6px; цветные file icons не фильтруются. Стили не меняют theme/font/font size, HC focus outlines или сохранённые размеры панелей. Структурные CSS heights 30/32px синхронизированы с CalmerStudioMetrics и проверяются computed styles; общая build registry CSS variables не менялась.

Проверки:
- Совместный browser прогон calmerStudio + modernUI.contribution + multiEditorTabsControl: 199/199, page errors 0, с настоящими CSS, локальным codicon font и PNG/data assets (без empty CSS loader). Включает настоящий constructor/DI MultiEditorTabsControl и существующие wrapping/connected/overflow/keyboard tests. Первоначальный 30-second timeout harness был недостаточным; итоговый bounded 120-second прогон завершился успешно, тесты не исключались.
- После добавления macOS override: 8 Calmer browser tests + 2 NativeTitlebarPart getter tests: 10/10, page errors 0. Native tests размещены в electron-browser test layer; браузерный unit harness не объявляется native Electron smoke.
- Всего 201 уникальная проверка в этих целевых suites; 10 новых. Проверены классы основного/aux окна, переключение Modern/Calmer/classic, dispose, config preservation, реальные CSS heights, compact tabs, loaded nested Explorer row updates, HC geometry, native height priority.
- ESLint всех изменённых TS и новых tests: passed. Stylelint одного нового CSS: passed. Selected TS syntactic/semantic diagnostics 12 файлов: 0. `git diff --check`: passed. Полный typecheck/build/package не запускался.

Подключение интегратором (scope nerded-calm-preset уже занят интегратором): видимая команда полного пресета должна выставить `workbench.calmerStudio=true`, `workbench.experimental.modernUI=false`, `workbench.colorTheme=Nerded Calm`, `workbench.iconTheme=nerded-calm-file-icons`. При выборе Classic/Modern команда снимает Calmer, чтобы состояние меню не вводило в заблуждение. Для чистого профиля интегратор настраивает defaults; текущие личные шрифты/размеры не сбрасывать.

Остаётся integration scope: видимое применение полного пресета, defaults минимизации activity rail/minimap/breadcrumbs, доступ к файлам/поиску/проекту и терминалу, начальные размеры только нового профиля, имя Nerded Code и утверждённая app icon. Реальный sidebar/terminal resize, split, menu/focus/HC/reduced motion и снимки приложения 1440x900/1024x768 — на собранном общем пакете; этот commit не заменяет native smoke, trust/no-idle-network/signing audit. Прежние темы/режимы сохранены.

Коммит реализации: `4f887b5228e`. Ветка: `agent/nerded-calm-layout`. База после fast-moving main синхронизирована merge `11928860e3b` (9d20e5acad9); никаких чужих source изменений в этой task не редактировалось. Тема/иконки отдельно готовы в agent/nerded-calm-theme-icons db06b6c3738 и уже забраны resource-интегратором. Готовы 2 из 3 согласованных визуальных scopes; общий preset/package/native integration остаётся у интегратора.
