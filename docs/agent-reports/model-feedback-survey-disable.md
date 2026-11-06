# model-feedback-survey-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/model-feedback-survey-disable. База: eab8fa4a00d3ad7911a0431fa0fe051320affb90.

P05/P02/A06: отключить runtime опросов качества моделей. Область: src/vs/workbench/contrib/chat/browser/feedbackSurvey/chatModelFeedbackSurveyService.ts и src/vs/workbench/contrib/chat/test/browser/feedbackSurvey/chatModelFeedbackSurveyService.test.ts, этот отчёт. Сохранить public interfaces/status/types/inert methods; удалить collection, experiment fetching, persistence, telemetry forwarding. Shared entrypoints/GitHub authorization исключены.

Код: `cb0a1a515d7`. Сервис больше не загружает experiment payload, не читает responses/comments, не пишет survey state/budgets и не отправляет telemetry/extension command. Public signatures/types сохранены, events Event.None, getSurvey undefined; 9 DI dependencies удалены.

Проверки: 2 browser regression tests passed (strict empty DI; все public методы с unreadable response и 0 events); ESLint 2 files passed; targeted TypeScript 2 files 0 diagnostics; git diff --check passed. Общие регистрации/UI/parser пока остаются; полное удаление surveys не заявляется. Full package/typecheck — интегратору, wiring не требуется.
