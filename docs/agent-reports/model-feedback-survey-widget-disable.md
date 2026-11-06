# model-feedback-survey-widget-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/model-feedback-survey-widget-disable. База: 69239325f989d66c7d6829601594de6368706dde.

P05/P02/A06: удалить inline survey widget runtime. Область: src/vs/workbench/contrib/chat/browser/feedbackSurvey/chatModelFeedbackSurveyWidget.ts и test/browser/feedbackSurvey/chatModelFeedbackSurveyWidget.test.ts относительно contrib/chat; этот отчёт. Constructor(container, restoreFocus), render(response), dispose сохранить. Общие entrypoints/chatListRenderer/CSS пока не менять; GitHub authorization исключена.

Код: `088b184758a`. Удалены form fields/buttons, context keys, service listeners, keyboard capture и focus changes. Container скрыт через native hidden property; render инертен, static constructor arguments сохранены, service dependencies удалены.

Проверки: 2 browser tests passed (strict empty DI + unreadable response/no focus; keyboard navigation not intercepted), ESLint 2 files passed; targeted TypeScript 2 files 0 diagnostics; git diff --check passed. Full package/typecheck интегратором. CSS пока остаётся: другая готовая ветка UI убирает последний import. Wiring не требуется; chatListRenderer продолжает создавать инертный adapter.
