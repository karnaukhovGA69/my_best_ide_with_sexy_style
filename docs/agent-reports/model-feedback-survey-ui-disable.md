# model-feedback-survey-ui-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/model-feedback-survey-ui-disable. База: 69239325f989d66c7d6829601594de6368706dde.

P05/P02/A06: снять feedback action registration/rendering и наблюдение model picker. Область: src/vs/workbench/contrib/chat/browser/actions/chatModelFeedbackSurveyActions.ts, browser/feedbackSurvey/chatModelFeedbackSurveyPromptContribution.ts и test/browser/feedbackSurvey/chatModelFeedbackSurveyActions.test.ts, chatModelFeedbackSurveyPromptContribution.test.ts относительно contrib/chat; этот отчёт. Public class IDs/functions и используемый focus helper сохранить. Shared entrypoints/GitHub authorization исключены.

Код: `1477a2bf93d`. Удалены registration/renderer и widget/model-selection listeners. Совместимые contribution classes инертны, без DI. Focus helper для оставшегося chatListRenderer сохранён.

Проверки: 5 browser tests passed (2 focus regressions + no registration/render dependencies/prompt dependencies); ESLint 4 files passed; targeted TypeScript 4 files 0 diagnostics; git diff --check passed. Full build/typecheck интегратором. Общие shared registrations можно удалить позднее, сейчас безопасны; полное удаление widget/parser не заявляется.
