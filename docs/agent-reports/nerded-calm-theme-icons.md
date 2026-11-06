# nerded-calm-theme-icons

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: visual implementation (бывший voice cleanup). Ветка: agent/nerded-calm-theme-icons. База: cfb88765d2317b09bb99bb9fa790929bccf7e3f2.

Источник требований: docs/agent-prompts/06-nerded-code-visual.md и docs/nerded-code-visual-spec.md, выбран Calmer Studio Original + цветные vscode-icons.

Точная область: новый каталог extensions/theme-nerded-calm/** — декларативный manifest/localization, тема, полный локальный icon-theme manifest и SVG assets, licenses/attribution/provenance, целевые resource tests; этот отчёт. Без activation/runtime JS, downloads или изменения пользовательских настроек. Общие product.json/build/allowlist/defaults/theme services/modernUI/layout и brand registration не менять: подключения передать интегратору. Не занимать nerded-calm-layout.

Проверки: palette/theme IDs, TextMate/semantic token colors, полный набор локальных icon references, case-sensitive/casefold-safe paths, отсутствие внешних ресурсов/активации; browser visual comparison с реальным Monaco/DOM и цветами темы, затем native smoke общего пакета интегратором. Включение в приложение и чистый профиль не объявлять выполненными до интеграции.


Результат: самостоятельное декларативное расширение `myself.theme-nerded-calm`; theme settings ID `Nerded Calm`, видимое имя Calmer Studio; icon settings ID `nerded-calm-file-icons`. 293 зарегистрированных цветовых токена, 29 TextMate rules, semantic highlighting, 16 ANSI цветов, непрозрачные editor/terminal #101010. Пользовательские override не изменяются. Layout/defaults/брендинг этим заданием не подключены.

vscode-icons 13.0.0: все 1 664 SVG сверены побайтно с официальным tag archive до очистки. Сохранены 1 508 definitions, 599 extensions, 1 922 filenames, 558 language IDs, 524 folder names и expanded-варианты, светлые overrides и generic fallback. Из восьми SVG убраны пустые script/link элементы, графика не менялась. Upstream manifest перенесён с относительными local paths; fallback к иконкам языковых расширений отключён. Runtime upstream extension не включён. MIT/CC BY-SA 4.0 тексты, исключение upstream для branded icons, атрибуция и SHA-256 provenance включены локально.

Проверки:
- `node --test extensions/theme-nerded-calm/test/resources.test.ts`: 8/8.
- `node extensions/theme-nerded-calm/test/runBrowserTests.ts`: 4/4, page errors 0; реальные ColorThemeData/FileIconThemeLoader, semantic/TextMate scopes, override после reload, HC isolation, CSS computed styles для unknown/TS/light Vite/folder open.
- Целевой ESLint трёх TS test/runner файлов: passed; selected TypeScript diagnostics трёх файлов: 0. Полный typecheck/build не запускался.
- Все color IDs сверены с регистрациями core и extension color contributions; 16 ANSI IDs проверены отдельно.
- Текст/синтаксис/диагностика/кнопки проверены на contrast >=4.5; заданный в ТЗ цвет неактивных номеров строк оставлен #77717E, проверка >=3. Не заявляется WCAG AA для этих номеров строк.
- Все SVG: exact-case local references, casefold uniqueness, hashes, отсутствие external href/url, script/link/foreignObject/animation/event handlers; git diff --check passed.
- Отдельный Chromium-стенд реальных Monaco + TextMate/Oniguruma + xterm + штатный icon CSS при 1440x900 и 1024x768: визуально просмотрен, 7 ожидаемых цветов токенов, editor rgb(16,16,16), местные image URLs, page errors 0. Артефакты `calmer-studio-components-1440.png` и `calmer-studio-components-1024.png` оставлены вне репозитория. Это component resource check, НЕ снимки готового приложения, native smoke и не проверка всего layout.

Подключение интегратором: включить `extensions/theme-nerded-calm` в allowlist/package, сохранить licenses/THIRD_PARTY_NOTICES; выбрать ID темы/иконок выше только для нового согласованного пресета, существующему профилю дать явную видимую команду. Layout/modernUI должен отдельно отключить glass/floating/pill treatment. Native screenshot/split/resize/HC/customization/security/no-idle-network — на общем интеграционном пакете. Не объявлять визуальную реализацию приложения завершённой только после merge этой темы.

Коммит реализации: `0c850ee7bf8`. Claim: `c0c729ca1e1`. Ветка: `agent/nerded-calm-theme-icons`. Готово 1 из 3 визуальных scopes; layout и интеграция остаются.
