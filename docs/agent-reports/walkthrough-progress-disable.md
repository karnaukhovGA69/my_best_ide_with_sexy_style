# walkthrough-progress-disable

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: 62f2cc32a7c. Ветка: agent/walkthrough-progress-disable.

U10/P02: удалить tracking прогресса обучения, автоматическое открытие walkthrough расширений и runtime подписки сервиса. Область: gettingStartedService.ts и новый test/browser/gettingStartedService.test.ts под welcomeGettingStarted; собственный отчёт. Сохранить типы/DI contract, pure media/description helpers и context key для оставшихся потребителей. Общие New File, GitHub, MCP/voice, startup/Welcome UI в этой задаче не менять. Полный типовой прогон пакетный.

Удалены runtime сбор walkthrough, extension install auto-open, command/view/config/file/sync listeners, completion tracking, progress/metadata storage, assignment/telemetry зависимости и reset progress command. Сервис создаётся без DI dependencies, возвращает пустой список, не читает descriptors, getWalkthrough явно сообщает недоступность. Существующие данные профиля не удаляются. Types/context key/description/media helpers и delayed registration сохранены.

Проверки: 4 browser tests passed, 0 page errors; targeted ESLint и git diff --check. Full client typecheck для предыдущего интеграционного среза прошёл; эта правка должна войти в следующую общую проверку. Welcome UI/startup ещё требуют отдельного отключения; обычный New File и GitHub не менялись.
