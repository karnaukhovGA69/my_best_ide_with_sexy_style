# chat-context-provider-runtime-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-context-provider-runtime-disable. База: ee6f4e41f92b323f499ac244a6541ef808c0568f.

P02. Область: chat/browser/contextContrib/chatContext.contribution.ts и chatContextService.ts; новый chat/test/browser/contextContrib/chatContextService.test.ts; этот отчёт. Убрать AI context extension point/startup contribution и provider runtime/activation/callback execution. Экспортированные service/class/contracts сохранить инертными; готовые context values возвращать без изменения, без очистки истории. Общие extension host/main-thread API, IntelliSense, Git/auth и shared entrypoints не менять.
