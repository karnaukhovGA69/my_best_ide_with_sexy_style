# harness-switch-survey-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/harness-switch-survey-disable. База: eab8fa4a00d3ad7911a0431fa0fe051320affb90.

P05/P02/A06: отключить Copilot-to-local harness switch survey runtime/telemetry/storage. Область: src/vs/workbench/contrib/chat/browser/feedbackSurvey/chatHarnessSwitchFeedbackSurveyService.ts и src/vs/workbench/contrib/chat/test/browser/feedbackSurvey/chatHarnessSwitchFeedbackSurveyService.test.ts; этот отчёт. Контекст/интерфейс prompt сохраняются инертными. Авторизацию GitHub, общие entrypoints, другой feedback не менять.

Код: `4ad338c0726`. Runtime survey UI, telemetry events/classifications, prompt persistence, widget listener удалены. Compatibility prompt инертен, DI-зависимостей нет.

Проверки: 1 regression browser test (strict empty DI + repeated prompt with unreadable context) passed; targeted ESLint 2 files passed; TypeScript 2 files 0 diagnostics; git diff --check passed. Full build/typecheck отложены до пакета интегратора. Wiring не требуется; общие survey settings/registrations вне области. Пользовательское хранилище не читается/не удаляется.
