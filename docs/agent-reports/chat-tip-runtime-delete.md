# chat-tip-runtime-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-tip-runtime-delete. База: b21b4ea407b4c7ecbc31d0b35289ee1b6e271dcf.

A06/P02: удалить встроенный chat tip runtime и tracking/catalog helpers. Область: src/vs/workbench/contrib/chat/browser/chatTipService.ts, chatTipCatalog.ts, chatTipEligibilityTracker.ts, chatTipStorageKeys.ts, createSlashCommandsUsageTracker.ts; src/vs/workbench/contrib/chat/test/browser/chatTipService.test.ts; этот отчёт. IChatTip/IChatTipProvider/IChatTipService и класс сервиса сохранить инертными. Module/export/command ID scan trackers/catalog/constants: внешних consumers нет, кроме удаляемых service/tests. Shared entrypoints/GitHub authorization/общие editor method hints исключены. Не очищать пользовательское storage.
