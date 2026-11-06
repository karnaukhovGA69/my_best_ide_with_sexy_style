# terminal-orphan-output-compression-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/terminal-orphan-output-compression-delete. База: a483b299cd519d10267b480c0352a8ce7feafe12.

P02: удалить orphan AI terminal output compression/cache. Область: src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/terminalOutputCompressor.ts; browser/tools/terminalOutputCache.ts; test/browser/terminalOutputCompressor.test.ts; test/browser/terminalOutputCache.test.ts; этот отчёт. Удаление только после consumer scan; terminalOutputHelpers, обычный терминал/shell/Tasks/Git/SSH и shared entrypoints не менять.

Расширение scope до правок: common helper tail в src/vs/workbench/contrib/chat/common/tools/toolResultCompressor.ts (isProtectedFromCompression/MIN_COMPRESSIBLE_LENGTH/formatCompressionBanner), сохранив DI/interface contracts. Зависимость: готовая agent/chat-tool-result-compression-disable, объединить её в собственную task-ветку перед удалением helpers.
