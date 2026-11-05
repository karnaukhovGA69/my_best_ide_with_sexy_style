# voice-input-affordances-disable

Статус: ГОТОВО к интеграции. Код и тесты: `c696a00465b`. Владелец: voice cleanup. Ветка: `agent/voice-input-affordances-disable`. База: `62f2cc32a7cfd017f9fb2e1d65ae22296a0bd674`.

A06: убрать voice/dictation context menus/listener, transcript overlay/glow и reactive/audio subscriptions. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/micButtonMenuActions.ts`, `src/vs/workbench/contrib/chat/test/browser/micButtonMenuActions.test.ts`, `src/vs/workbench/contrib/chat/browser/voiceClient/voiceInputDecorations.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceInputDecorations.test.ts` и этот отчёт. Сохранить API/types/constants для callers; общие entrypoints, leaf glow implementations, GitHub/auth/catalog/backup, сборка и чужие задачи исключены.

Удалены меню voice/dictation и contextmenu listener, transcript overlay/scrollbar, glow controller creation, audio reads, requestAnimationFrame, autoruns/config/theme subscriptions. Экспортированные API/types/constants сохранены как неактивные adapters; DOM/styles/services не читаются и не меняются.

Проверки: 4 browser tests passed; targeted ESLint 4 файлов passed (исправлен restricted window в тесте, повторный lint затронутого файла и browser tests прошёл); semantic/syntactic TypeScript 4 файлов — 0 до однострочного исправления window на imported mainWindow; git diff --check passed. Проверены unreadable services/options, отсутствие actions, сохранение bubbling/default contextmenu, неизменность input/glow DOM/styles после observable updates, отсутствие RAF/timers. ESBuild/Playwright runner; без full/native build. Dependencies неизменны; pnpm skills warning.

Интегратору: `c696a00465b` и отчёт. Wiring не нужен; sessions re-export автоматически получает неактивный adapter. Общий smoke обычного input/contextmenu на пакетной сборке. Leaf glow/controller/CSS и registrations отдельных commands остаются. GitHub/auth/catalog/backup/main/build не менялись.
