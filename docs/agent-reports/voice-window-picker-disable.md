# voice-window-picker-disable

Статус: ГОТОВО к интеграции. Код и тесты: `7a2b87f5e5c`. Ветка: `agent/voice-window-picker-disable`. Владелец: агент voice cleanup. База: `5f88b8b3d41`.

До правок зарезервированы `src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWindowService.ts`, `src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceSessionsPicker.ts`, новый `src/vs/workbench/contrib/agentsVoice/test/browser/agentsVoiceWindowService.test.ts` и этот отчёт. A06: убрать floating window, BroadcastChannel, storage/listeners/timers и session picker. Общие entrypoints, GitHub/auth/backup, MCP/documents не менять.

Удалены floating-window creation, BroadcastChannel ownership, window/storage listeners, background session polling, resize timers, callbacks к voice/chat services и QuickPick session selection. Сохранены delayed singleton, interface и неактивный picker с constructor callback для совместимости. open/toggle/show бездействуют; isOpen false, event Event.None. User storage не читается и не переписывается.

Проверки: 4 browser tests passed; targeted ESLint 3 файлов passed; targeted TypeScript semantic/syntactic diagnostics 3 файлов — 0; git diff --check passed. Проверены strict DI без workbench services, отсутствие window/channel/listeners/timers, repeated opens/toggles/disposal и отсутствие callback selection. Browser esbuild/Playwright runner, scratch вне repo; не native smoke и не полный typecheck.

Интегратору: перенос `7a2b87f5e5c` плюс отчёт; wiring не требуется. На общем output — agentsVoiceWindowService.test.js и общий DI/startup smoke накопленного пакета. Main/build/release не менялись. Зависимости переиспользованы; локальный pnpm предупреждает о workspace setting skills. Остальной widget/onboarding source пока остаётся, полное удаление голоса/AI не заявляется. GitHub/auth/catalog/backup исключены по указанию пользователя.
