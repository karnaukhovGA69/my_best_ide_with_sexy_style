# survey-orphan-config-delete

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/survey-orphan-config-delete. База: b21b4ea407b4c7ecbc31d0b35289ee1b6e271dcf + собственные готовые dependencies model-survey-orphan-support-delete fdf9751b5f1 и survey-orphan-editor-delete ad5cd2fb788. Объединение только в собственном worktree.

Область: src/vs/workbench/contrib/chat/common/feedbackSurvey/chatModelFeedbackSurveyConfig.ts, src/vs/workbench/contrib/chat/test/common/feedbackSurvey/chatModelFeedbackSurveyConfig.test.ts, src/vs/workbench/contrib/surveys/browser/surveyQuestions.ts и этот отчёт. Удалить orphan parser/matcher/constants/tests/editor-question catalog. Сохранить используемые config interfaces/enum. Shared entrypoints/GitHub authorization исключены.

Код: `2a917977b4d`. Удалены parser/matcher/helpers/limits, obsolete parser tests и surveyQuestions catalog. Config shapes/enum сохранены для compatibility consumers. Уточнение: ссылка на surveyQuestions в config была лишь комментарием, runtime import отсутствовал.

Проверки: references удалённых functions/types/constants/catalog 0 в src/test/build; ESLint config passed; targeted TypeScript config+retained mock 2 files 0 diagnostics; git diff --check passed. Новые тесты для dead-code-only удаления не добавлялись; full typecheck/package интегратором. Ветка содержит перечисленные зависимости, принимать head или deletion commit после них.
