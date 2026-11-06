# model-feedback-survey-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/model-feedback-survey-disable. База: eab8fa4a00d3ad7911a0431fa0fe051320affb90.

P05/P02/A06: отключить runtime опросов качества моделей. Область: src/vs/workbench/contrib/chat/browser/feedbackSurvey/chatModelFeedbackSurveyService.ts и src/vs/workbench/contrib/chat/test/browser/feedbackSurvey/chatModelFeedbackSurveyService.test.ts, этот отчёт. Сохранить public interfaces/status/types/inert methods; удалить collection, experiment fetching, persistence, telemetry forwarding. Shared entrypoints/GitHub authorization исключены.
