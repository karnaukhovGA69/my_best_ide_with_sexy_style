# inline-suggestion-settings-remove

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/inline-suggestion-settings-remove. База: main 411cccde06e.

Область: только schema в class InlineEditorSuggest файла src/vs/editor/common/config/editorOptions.ts, новый src/vs/editor/test/browser/config/inlineSuggestionDistribution.test.ts, этот отчёт. Удалить устаревшие пользовательские настройки inline/next-edit suggestions из registry/UI, сохранив enum option IDs, внутреннюю option shape/defaults/validation и extension API. Обычные suggest/quickSuggestions не менять. Проверки существующей editor configuration и Suggest suite; полный typecheck общей области только интегратором. Другие секции editorOptions и файлы остальных агентов не затрагивать.
