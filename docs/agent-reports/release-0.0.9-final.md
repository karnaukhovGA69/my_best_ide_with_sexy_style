# release-0.0.9-final

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. Ветка: integration/release-0.0.9-final. База: main 8a9f66bc9af после семи срезов integration-post-0.0.9.

Область: один общий macOS ARM64 package/native/sign/privacy/ZIP/release цикл всех накопленных изменений main до этой базы. Полный client typecheck седьмого среза прошёл; исходные inputs после него не менялись. Новая сборка обоснована четырьмя срезами, отсутствующими в локальном build 7e52ba80469. Не расширять snapshot готовыми задачами, появившимися позднее. Не запускать параллельные package/typecheck. GitHub authorization/связанные task branches исключены.

Старый binary 41c46a51f99 сохраняется в отдельном snapshot-каталоге; проверенная локальная сборка другого агента 7e52ba80469 не меняется. Native smoke, документы/Save As/settings, PDF и подпись/ASAR/privacy/ZIP — обязательные проверки перед публикацией. Результаты старых проверок переиспользуются только для неизменившихся inputs и явно отделяются от нового binary QA. Последний опубликованный release пока 0.0.8.

Исходный snapshot нового package: `9d93537d452e1402c10bcc724daaefa5d2b887fd`. Production package macOS ARM64 прошёл (exit 0), включая extension/media checks и build-path sanitation. Старый 41c46a51f99 binary сохранён в каталоге с suffix snapshot-41c46a51f99. Deep ad-hoc signing → ASAR metadata refresh → outer signing → deep strict verify и post-sign build-path guard прошли.

Native packaged smoke на 9d93537d452 прошёл: Git activation, bash/zsh, shell Task exit 0, method suggestions, ручной formatter (0 calls on save), manual VSIX 0.0.1 → 0.0.2 → uninstall. Проверено отсутствие удалённых update/survey/chat-tip/inline команд. Documents native API suite passed: new/open/custom editor, undo/redo, CRLF save/reopen, external change и targeted Save As single-tab replacement с сохранением другой вкладки. Это API regression, не полный native Save Dialog UI сценарий.

Ещё не завершены для этого snapshot: PDF/native UI проверки, финальный ASAR/ZIP audit и публикация. Старые PDF/settings UI результаты не выдаются за новые. Package повторно не запускать без реального source fix.
