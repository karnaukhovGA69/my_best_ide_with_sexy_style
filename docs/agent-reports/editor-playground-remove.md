# editor-playground-remove

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: 5f88b8b3d41. Ветка: agent/editor-playground-remove.

Область: src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThrough.contribution.ts, новый test/browser/walkThrough.contribution.test.ts и точечное удаление его import из workbench.common.main.ts. U10: снять playground editor/serializer/provider/actions/menu/keybindings. Остальные Welcome/New File, extension API, общие редакторы, GitHub, MCP/voice не менять. Проверки целевые, полный пакет позже.

Удалены регистрации Playground editor pane, serializer, snippet content provider, команды открытия, четырёх навигационных команд/клавиш и Help entry. Основной workbench больше не импортирует contribution; сам модуль инертен даже при прямом import. Реализации editor/input/content provider пока остаются в дереве исходников; полное удаление Welcome не заявляется.

Проверки: 3 browser Mocha tests в headless Chromium (команды, Help/Palette, keybindings), 0 page errors; targeted ESLint трёх файлов и git diff --check. Поиск внешних ссылок не выявил производственных вызовов showInteractivePlayground за пределами этой области. Full typecheck/native smoke остаются для общего пакета.
