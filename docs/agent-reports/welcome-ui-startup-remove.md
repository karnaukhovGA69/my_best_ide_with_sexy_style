# welcome-ui-startup-remove

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: c440fbac58c (включает walkthrough-progress-disable). Ветка: agent/welcome-ui-startup-remove.

Область: welcomeGettingStarted/browser/gettingStarted.contribution.ts, startupPage.ts, новый test/browser/startupPage.test.ts, собственный отчёт. Снять Welcome UI/editor/actions/settings и startup onboarding/restore walkthrough. Сохранить WorkspacePlatform context и выбранный пользователем запуск README/терминала/newUntitledFile. GitHub и активные MCP/voice/log задачи не менять. Бинарный цикл после объединения пакета.

Удалены Welcome editor/serializer/resolver, шесть UI commands/menu/keybinding, accessible view, walkthrough/onboarding settings, startup welcome/onboarding/telemetry notice bookkeeping и восстановление туров из storage. Startup setting оставляет none/readme/newUntitledFile/terminal с default none; старые welcome значения игнорируются. WorkspacePlatform и icons exports сохранены; newUntitledFile по-прежнему обрабатывает workbench layout. README/терминал и запрет замены восстановленного редактора сохранены. Markdown preview больше не вызывается для списка без Markdown.

Проверки: 10 browser tests passed, 0 page errors; ESLint без предупреждений и git diff --check. Mock services в первом прогоне требовали явной инициализации; фикстура исправлена. Проверены старые startup values, terminal, reload/skip/active-editor, README.md/README.txt/missing README и отсутствие Welcome commands. Исходники страницы остаются для последующего анализа; полный typecheck и native smoke — общий пакет. Пользовательские данные не удалялись.
