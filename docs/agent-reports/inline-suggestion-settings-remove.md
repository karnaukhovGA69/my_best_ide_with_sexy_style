# inline-suggestion-settings-remove

Статус: ГОТОВО к интеграции следующего пакета. Ветка: agent/inline-suggestion-settings-remove. База: main 411cccde06e. Владелец: чат упрощения Myself IDE.

В class InlineEditorSuggest файла editorOptions.ts удалён только schema пользовательских editor.inlineSuggest.* settings. Отключённый inline UI больше не рекламирует параметры toolbar/ghost text/next-edit suggestions в Settings. Сохранены enum IDs, форма опций, прежние внутренние defaults и validation для API consumers. Обычные suggest/quickSuggestions не менялись. Это очистка Settings; отключение UI обеспечено ранее интегрированной inline-completions-runtime-disable, а не этим изменением.

Проверки: 44 browser Mocha tests passed (2 новых, существующие editorConfiguration и Suggest suites), 0 page errors. Новый regression проверяет реальный configuration registry и isEditorConfigurationKey, наличие normal quickSuggestions/showMethods; второй — совместимость валидации API. Scoped TypeScript двух файлов — 0 diagnostics; ESLint двух файлов и git diff --check прошли. Со старым editorOptions.ts из 411cccde06e regression на отсутствие настроек ожидаемо падает, compatibility test проходит, без page errors.

Wiring не требуется. Правка ограничена одной schema в общем editorOptions; другие секции и файлы других владельцев не менялись. Полные client typecheck/package/native выполняет интегратор на пакете. Текущий binary snapshot не расширялся.
