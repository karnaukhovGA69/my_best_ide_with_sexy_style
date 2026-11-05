# voice-widget-binding-disable

Статус: ГОТОВО к интеграции. Код и тесты: `77ef09b4009`. Владелец: voice cleanup. Ветка: `agent/voice-widget-binding-disable`. База: `5f88b8b3d41`.

До правок зарезервированы `src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidget.ts`, `src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidgetBinding.ts`, новый `src/vs/workbench/contrib/agentsVoice/test/browser/agentsVoiceWidget.test.ts` и этот отчёт. A06: убрать widget DOM/actions/audio visualization, feedback/onboarding и session/controller bindings. Сохранить signatures для callers. Не менять shared entrypoints, component leaf files, GitHub/auth/backup, других агентов.

Удалены widget DOM/actions/feedback/onboarding/animations, callbacks, reactive state и привязка к session/controller/playback/model data. Exported interfaces/constructor/setters сохранены как явно неактивный adapter. Контейнер и callbacks не читаются; binding возвращает Disposable.None без чтения services. Leaf components остаются отдельными исходниками, shared entrypoints не менялись.

Проверки: 4 browser tests passed; targeted ESLint 3 файлов passed; TypeScript semantic/syntactic 3 файлов — 0; git diff --check passed. Проверены unreadable Proxy inputs/services, все setters, container preservation, отсутствие requestAnimationFrame/timers/callbacks, repeated disposal. ESBuild/Playwright browser runner, не native/full build. Dependencies неизменны; pnpm skills warning.

Интегратору: `77ef09b4009` плюс отчёт, вместе с voice-window-picker-disable и voice-onboarding-disable в пакет; patches разных файлов. Нового wiring не требуется. Общий smoke должен подтвердить отсутствие voice widget и сохранность обычного chat input container. GitHub/auth/catalog/backup исключены; main/build/release не менялись. Не объявлять весь AI удалённым.
