# ghostty-embedding-assessment

Статус: ГОТОВО — исследование NEW04, не реализация встроенного Ghostty. Владелец: чат упрощения Myself IDE. Ветка: agent/ghostty-embedding-assessment. Локальная база: main eab8fa4a00d. Проверка источников: 6 ноября 2026. Runtime, зависимости, shell/profile, общий build и выбранный snapshot сборщика не изменены.

Вывод: встраивание VT-движка реально, но готовой совместимой замены нынешней панели нет. Для первого отдельного прототипа предпочтителен WASM в существующем renderer с сохранением нынешнего PTY транспорта; штатный xterm оставить вариантом по умолчанию. Нативную Metal-поверхность внутри Electron сейчас не включать в продукт. Это инженерная рекомендация по найденным интерфейсам, а не измеренное сравнение скорости.

## Первичные источники

- [Ghostty packaging library](https://github.com/ghostty-org/ghostty/blob/2c76f29972dad21d3f2cc0efde2517a6fa8fed56/PACKAGING-LIBGHOSTTY.md): libghostty-vt отвечает за VT parsing и terminal state; имеет отдельную от приложения версию и сборки WebAssembly. Документ применим только к соответствующим исходникам. Для эксперимента фиксировать библиотеку, ABI, WASM и контрольную сумму совместно; номер GUI Ghostty не заменяет версию библиотеки.
- [Ghostty internal header](https://github.com/ghostty-org/ghostty/blob/2c76f29972dad21d3f2cc0efde2517a6fa8fed56/include/ghostty.h): API нативного embedder прямо помечен internal, приспособлен к macOS и не предназначен для внешних пользователей; внешним приложениям рекомендован libghostty-vt. Наличие C ABI не означает стабильный готовый Electron widget.
- [Ghostty 1.4 release notes](https://ghostty.org/docs/install/release-notes/1-4-0#libghostty): на дату выпуска приложения API библиотеки ещё описывался как меняющийся. Текущий main packaging уже описывает отдельный release workflow; это не доказательство стабильности произвольного выбранного ABI. Перед реализацией отдельно зафиксировать конкретный tag/commit.
- [ghostty-web terminal](https://github.com/coder/ghostty-web/blob/640db4617c69a73ccebce437cebc598c7f73cdb7/lib/terminal.ts) и [renderer](https://github.com/coder/ghostty-web/blob/640db4617c69a73ccebce437cebc598c7f73cdb7/lib/renderer.ts): Coder предоставляет browser-wrapper с Ghostty WASM и собственным CanvasRenderer. Это не Metal renderer приложения Ghostty. В проверенном Terminal нет registerMarker, registerDecoration и parser API, нужных нашему workbench. Заявление о совместимости с xterm не покрывает эти зависимости.
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window#wingetnativewindowhandle): на macOS доступен NSView handle. Вывод для проекта: отдельный native bridge технически можно исследовать, но handle сам по себе не решает clipping, фокус, IME, accessibility и размещение native surface относительно DOM.

Heads внешних main получены read-only через GitHub API: ghostty-org/ghostty 2c76f29972dad21d3f2cc0efde2517a6fa8fed56, coder/ghostty-web 640db4617c69a73ccebce437cebc598c7f73cdb7. Clone/fetch внешних репозиториев не выполнялись. Tip API website не открылся инструментом; выводы опираются на доступные исходники и официальную документацию, не на его непроверенное содержимое.

## Препятствия в текущем форке

| Участок | Проверенный код | Что потребуется |
| --- | --- | --- |
| Создание панели | src/vs/workbench/contrib/terminal/browser/terminalInstance.ts импортирует @xterm/xterm и создаёт XtermTerminal | Отдельный backend adapter вместо замены одного import |
| Renderer и addons | browser/xterm/xtermTerminal.ts и xtermAddonImporter.ts: WebGL, search, serialize, image, ligatures, clipboard, progress | Сопоставить поведение каждого addon, не грузить xterm addons в несовместимый runtime |
| Private API | xtermTerminal.ts обращается к raw._core и viewport._innerRefresh; xterm-private.d.ts фиксирует внутренние типы | Убрать эти зависимости из нового adapter либо явно оставить функцию на xterm |
| Команды и cwd | src/vs/platform/terminal/common/xterm/shellIntegrationAddon.ts использует parser.registerOscHandler; lineDataEventAddon.ts использует registerCsiHandler | Поддержать прежние shell integration sequences, nonce и события без изменения пользовательского shell |
| История и decorations | markNavigationAddon.ts и decorationAddon.ts используют registerMarker/registerDecoration | Сохранить навигацию команд, выделение и позиционирование маркеров после scroll/resize |
| Восстановление | src/vs/platform/terminal/node/ptyService.ts использует @xterm/headless и сериализацию состояния | Проверить replay между backend-ами; не объявлять frontend-only замену полным удалением xterm |

## Границы следующего прототипа

1. Отдельная экспериментальная панель, один локальный PTY и закреплённый WASM asset без CDN/загрузки при старте. Не подменять существующие terminal/Tasks. Никакого переноса настроек Ghostty целиком: явно сопоставить только поддержанные font/colors/cursor/scrollback.
2. Сначала replay фиксированных синтетических потоков: ANSI cursor/erase/colors, alternate screen, resize, кириллица, emoji/combining/CJK, длинные строки, scrollback. Сравнить текст/курсор/режимы, не только картинку.
3. Затем живой PTY: ввод/вставка/выделение, IME, Ctrl-C, resize, закрытие панели и процесса, split/focus, reconnect/replay. Сохранить установленный shell и его плагины; shell initialization автоматически не переписывать.
4. До замены основной панели обязательны shell integration, Tasks, hyperlinks, поиск, accessibility, lifecycle/disposal и сохранение сессии. Проверить current workbench shellIntegrationAddon, markNavigationAddon, lineDataEventAddon и xtermTerminal suites через реальный adapter.
5. Сравнить p50/p95 input latency, throughput, память при одинаковом scrollback, resize и background CPU с xterm WebGL на одной машине и потоках. Сейчас замеров нет; ускорение не обещается. Прекратить миграцию в текущем пакете, если adapter требует фактически переписать addons или ломает обязательные сценарии.

Оценка сложности: WASM proof-of-concept — ограниченный эксперимент; полноценная замена панели — существенная отдельная задача из-за IDE integration. Нативный Metal вариант дополнительно требует macOS bridge, native packaging/signing и отдельного решения для остальных платформ; по нынешним данным он дороже первого WASM эксперимента. Внешний запуск Ghostty уже решается отдельным external-terminal-menu и не доказывает встраивание.

Верификация этой задачи: read-only source audit и первичные web sources, git diff --check. Тесты приложения и сборка не запускались: изменён только исследовательский отчёт. Реализация прототипа, производительность и native compatibility не заявлены проверенными. Интегратору достаточно принять этот отчёт; изменения root dependencies и entrypoints отсутствуют.
