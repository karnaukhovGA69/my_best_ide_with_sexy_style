# terminal-orphan-output-compression-delete

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/terminal-orphan-output-compression-delete. База: a483b299cd519d10267b480c0352a8ce7feafe12.

P02: удалить orphan AI terminal output compression/cache. Область: src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/terminalOutputCompressor.ts; browser/tools/terminalOutputCache.ts; test/browser/terminalOutputCompressor.test.ts; test/browser/terminalOutputCache.test.ts; этот отчёт. Удаление только после consumer scan; terminalOutputHelpers, обычный терминал/shell/Tasks/Git/SSH и shared entrypoints не менять.

Расширение scope до правок: common helper tail в src/vs/workbench/contrib/chat/common/tools/toolResultCompressor.ts (isProtectedFromCompression/MIN_COMPRESSIBLE_LENGTH/formatCompressionBanner), сохранив DI/interface contracts. Зависимость: готовая agent/chat-tool-result-compression-disable, объединить её в собственную task-ветку перед удалением helpers.

Код: `b82c1fb5e08`. Удалены 4 orphan terminal compression/cache implementation/test files и 3 orphan common helpers; -1441 строк. Consumer scan module paths/exported registration/cache/helper symbols src/test/build после удаления — 0. Dependency agent/chat-tool-result-compression-disable объединена без конфликтов. Общий parser и terminal/shell/Tasks не изменены.

Проверки: повторная интеграционная проверка 2 browser tests pass-through сервиса (не новые тесты); ESLint common file; selected-file semantic types 3 файлов (0 diagnostics); git diff --check — passed. Интегратору объединить task-ветку с её зависимостью. Full typecheck/build/package не запускались.
