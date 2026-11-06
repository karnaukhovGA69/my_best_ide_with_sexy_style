# chat-context-provider-runtime-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-context-provider-runtime-disable. База: ee6f4e41f92b323f499ac244a6541ef808c0568f.

P02. Область: chat/browser/contextContrib/chatContext.contribution.ts и chatContextService.ts; новый chat/test/browser/contextContrib/chatContextService.test.ts; этот отчёт. Убрать AI context extension point/startup contribution и provider runtime/activation/callback execution. Экспортированные service/class/contracts сохранить инертными; готовые context values возвращать без изменения, без очистки истории. Общие extension host/main-thread API, IntelliSense, Git/auth и shared entrypoints не менять.

Реализация: cb7a888630e. Удалены chatContext extension point/startup registration, provider/picker maps, extension activation, сбор workspace/resource values и command callbacks. Compatibility методы не сохраняют providers и не выполняют их; resolveChatContext возвращает исходное значение без мутации. Singleton сохранён для main-thread API.

Проверки: 3 browser regressions, 0 failures/page errors; lint 3 изменённых файлов; выбранные TS diagnostics 4 файлов, включая неизменённый mainThreadChatContext consumer, без ошибок. В тестовой fixture добавлен обязательный handle после browser run; lint/types повторены. diff --check пройден. IntelliSense/general extension host/Git/auth не менялись. Полный DI/typecheck и native smoke — интегратор.
