# agents-window-shortcut-tip-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agents-window-shortcut-tip-disable. База: fa5f110f488604b14c34fa332a38772c3caadf62.

A06: удалить registration/provider совета добавления global keybinding Agents Window. Область: src/vs/sessions/contrib/openAgentsWindow/electron-browser/openAgentsWindowKeybindingTip.ts и test/electron-browser/openAgentsWindowKeybindingTip.test.ts относительно openAgentsWindow, этот отчёт. Export symbol scan: внешних consumers класса/constants нет; side-effect module оставить инертным для shared entrypoints. General keybindings/пользовательские settings/shared entrypoints/GitHub authorization исключены.

Код: `5f3747dd951`. Удалены provider/contribution/command registration, keyboard/storage observation, shortcut editing/notifications. Экспорты класса/constants не имели внешних consumers; module теперь inert для side-effect imports. User bindings/storage не изменяются и не очищаются.

Проверки: 1 browser test (enable shortcut command absent) passed; targeted ESLint 2 files passed; TypeScript 2 files 0 diagnostics; git diff --check passed. General system-wide keybinding infrastructure сохранена. Full build/typecheck интегратором, wiring не требуется.
