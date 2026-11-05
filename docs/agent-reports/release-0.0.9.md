# release-0.0.9

Статус: ЗАНЯТО. Владелец: интегратор. Ветка: integration/release-0.0.9. Состав: четыре среза integration-next-package и локальный settings-file-portability с подключёнными меню. Новые task branches после этого snapshot не включаются в уже запущенную сборку.

Область: общий typecheck/bundle/package, native smoke обычного редактора/терминала/Tasks/Git/formatter/VSIX и новых settings import/export/documents Save As; PDF regression/signing/build-path/ASAR/ZIP audit; публикация prerelease только после проверок. Активные агенты продолжают независимые задачи от main, не редактировать их worktree. Последний опубликованный бинарник пока 0.0.8.

Native QA: найден дубликат текстовой вкладки после Save As документа; исправление extensions/myself-documents/src/extension.ts и test/provider.test.cts ЗАНЯТО интегратором до публикации. Экспорт settings прошёл; импорт JSONC в нативном диалоге требует дополнительной проверки (кнопка открытия недоступна).

Save As исправлен вызовом reopenActiveEditorWith с URI результата: замена существующей вкладки вместо добавления второй. 16 tests + compile extension/webview + ESLint прошли. Native settings: экспорт JSON, импорт JSON с комментариями, diff с Apply/Discard и применение двух параметров прошли; комментарий текущего settings.json сохранён, два неподходящих ключа исключены. Отмена диалога не меняет профиль. Нативный AX показывал устаревшие состояния; JSONC-фильтр не объявляется дефектом продукта на этом основании. Повторная сборка обоснована исправлением подтверждённого native Save As дефекта.
