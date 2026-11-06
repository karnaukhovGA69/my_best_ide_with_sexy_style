# chat-tip-runtime-delete

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-tip-runtime-delete. База: b21b4ea407b4c7ecbc31d0b35289ee1b6e271dcf.

A06/P02: удалить встроенный chat tip runtime и tracking/catalog helpers. Область: src/vs/workbench/contrib/chat/browser/chatTipService.ts, chatTipCatalog.ts, chatTipEligibilityTracker.ts, chatTipStorageKeys.ts, createSlashCommandsUsageTracker.ts; src/vs/workbench/contrib/chat/test/browser/chatTipService.test.ts; этот отчёт. IChatTip/IChatTipProvider/IChatTipService и класс сервиса сохранить инертными. Module/export/command ID scan trackers/catalog/constants: внешних consumers нет, кроме удаляемых service/tests. Shared entrypoints/GitHub authorization/общие editor method hints исключены. Не очищать пользовательское storage.

Код: `30b8c5e6f30`. Удалены 4 helper файла и весь runtime сервиса: catalog/tip selection/eligibility signals, command/tool/prompt tracking, experiments, telemetry, storage migrations/reads/writes. Provider callbacks не читаются, getters undefined/false, events Event.None, state methods no-op. Удалённые reexports/tracking IDs не имеют внешних source consumers. Сохранены service/provider/tip contracts.

Проверки: 3 browser regression tests passed (empty DI, unreadable provider/context, all state methods/0 events); targeted ESLint 2 files passed; TypeScript 2 files 0 diagnostics; module/symbol/command reference scan чистый; git diff --check passed. Full typecheck/package интегратором. User settings/storage не очищаются. Tip presenter/content UI остаются отдельной областью; wiring не требуется.
