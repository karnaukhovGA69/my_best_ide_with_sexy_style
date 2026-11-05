# github-link-presentations-remove

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: b73001809cd. Ветка: agent/github-link-presentations-remove.

Решение владельца об отказе от GitHub-модуля: удалить встроенный GitHub link presentation provider (repository/issues/PR details, hydration/watchers и sign-in notification). Область: src/vs/workbench/contrib/github/browser/githubLinkPresentation.contribution.ts, его test/browser/githubLinkPresentation.test.ts, import workbench.common.main.ts. Оставить обычные URI/link opener, Git/SSH/clone, общий authentication API и другие GitHub consumers. Перед физическим удалением проверить imports. SettingsTransfer и активные MCP/voice задачи не трогать.

Физически удалены 450 строк provider/hydrator/watcher implementation и 475 строк его obsolete tests, а также startup import. Repository search по src/extensions/build/scripts/test не нашёл оставшихся imports/classes. Удалённый путь больше не запрашивает credentials/details, не создаёт watchers/AbortController/microtask batch и не предлагает sign-in. Другие GitHub services/resource resolver/source modules остаются отдельной работой; full GitHub removal не заявляется.

Проверки: 9 существующих browser tests общего DataChannel/link presentation extension API прошли, 0 page errors; lint common entrypoint и git diff --check прошли. Новая проверка поведения удалённой реализации не добавлялась; оставшаяся общая API проверена. Typecheck/package/native — на следующем пакете.
