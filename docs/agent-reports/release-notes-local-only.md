# Release notes local only

Статус: ГОТОВО к интеграции. Владелец: MCP/build agent. База: main 9be3b2c89dc, claim 41e9cbf156b. Ветка: agent/release-notes-local-only.

Область: src/vs/workbench/contrib/update/browser/releaseNotesEditor.ts, update.contribution.ts, test/browser/releaseNotesEditor.test.ts, disabledUpdate.contribution.test.ts и этот отчёт. Дополнительные файлы contribution зарезервированы перед правкой после завершённой ide-updater-disable. Git/GitHub, SSH, терминалы, workspace/окружения, общий Markdown preview и общие entrypoints не менялись.

## Реализация

Удалены загрузчик удалённых release notes, IRequestService и сетевой cache. Обычная команда показывает локальную инструкцию без обращения к серверу и без требования числовой версии. Help содержит видимый пункт Open Current File as Release Notes; browser fallback в этом action удалён. Документ берётся из открытой локальной модели целиком, включая несохранённые изменения; текст перед первым заголовком не отбрасывается. Отсутствующая модель, untitled, HTTP(S), remote URI и file URI с сетевой authority отклоняются.

Текст и каталог ресурсов фиксируются до первого await. Разрешения localResourceRoots заменяются при каждом новом документе и сбрасываются для инструкции. CSP запрещает внешние media/styles/connect, допускает точный служебный origin локальных file-ресурсов и изображения data. Оставлены nonce для собственных скриптов/стилей, relative media и прежний ограниченный список команд для явных кликов. Абсолютные HTTP(S) media-атрибуты удаляются также sanitizer-ом. Base URI экранируется, включая кавычки в названии папки. Служебный HTTPS origin ресурсов перехватывается существующим webview service worker; это не разрешение на произвольный HTTPS и не глобальный OS firewall.

## Проверки

126 browser tests passed: releaseNotesEditor, releaseNotesRenderer, releaseNotesTryouts, disabledUpdate.contribution. Выполнены через локальную esbuild-сборку исходных suites, Mocha TDD и Playwright Chromium, с проверкой существующих snapshots без их записи. 0 page errors, 0 внешних HTTPS-запросов в harness; потенциальные внешние запросы перехватывались и считались ошибкой. В новых тестах: отклонение удалённых документов, отсутствие request service, сохранение локального текста/media, замена roots, согласованность модели после await, экранирование base и реальное выполнение CSP браузером против внешних image/video/style/fetch. CSP тест не заменяет native webview smoke.

Целевой ESLint четырёх TypeScript-файлов и git diff --check прошли. Полный typecheck DI, production package, native local-image/video smoke и общая проверка отсутствия сетевых запросов при запуске приложения должны выполняться интегратором в общем пакете; здесь они не запускались. Не считать результат аудитом всего приложения. Известные ограничения: browser fallback в старом update.ts остался вне области этой задачи (startup updater ранее не зарегистрирован); явные пользовательские переходы по ссылкам сохраняются; системные mounts и ресурсы произвольных расширений не изолируются этим изменением.

## Решение владельца для первого релиза

Локальный редактор: файлы, workspace, терминал, вручную добавленная документация. Обычный системный Git и ручные git/ssh-команды сохраняются; фоновые сетевые действия IDE должны быть выключены и проверены. Собственные GitHub login/catalog/root-clone и интеграция Remote SSH отложены. Это решение передано трём работающим агентам. Наследование upstream-кода не является гарантией безопасности форка. Сохранять Workspace Trust, Electron sandbox, CSP, TLS/SSH-проверки; перед выпуском проверить недоверенный workspace без --disable-workspace-trust и сетевое поведение готового приложения.

Подключение интегратором: cherry-pick итогового fix-коммита вместе с этим отчётом; дополнительных product/build registrations не требуется. Публичный push и новая сборка в рамках этой задачи не выполнялись.

Итоговый коммит: 42e11ba941a.
