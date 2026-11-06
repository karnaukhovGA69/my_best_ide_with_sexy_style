# agent-folder-picker-tip-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-folder-picker-tip-disable. База: f9f821d47f632bfd5afca144685208f5f99e42c2.

A03: отключить встроенный folder picker tip. Область: src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostFolderPickerTip.ts и test/browser/agentSessions/agentHostFolderPickerTip.test.ts относительно contrib/chat; этот отчёт. Сохранить factory/list-options API и CSS class, убрать storage reads/writes/header/link. Общий folder picker/GitHub authorization/shared entrypoints исключены.

Код: `1ea83eba52f`. List options сохраняют CSS class без header/link/dismiss action. Storage не читается/не меняется. 1 browser test passed; lint 2 files passed; targeted types 2 files 0 diagnostics; diff --check passed. Full проверки интегратором; wiring не требуется.
