# mcp-gallery-disable

Статус: реализация завершена, готова к интеграции; не брать повторно. Владелец: агент mcp-audit. Ветка: `agent/mcp-gallery-disable`. База: `01293638a167e4d1b6da6036bd396ab81a2f6780`.

Зарезервировано до реализации: `src/vs/platform/mcp/common/mcpGalleryManifestService.ts`, `src/vs/platform/mcp/common/mcpGalleryManifestServiceIpc.ts`, `src/vs/workbench/services/mcp/browser/mcpGalleryManifestService.ts`, `src/vs/workbench/services/mcp/electron-browser/mcpGalleryManifestService.ts`, целевые новые тесты этих сервисов и этот отчёт. Не назначать второго владельца этой области.

Цель: исключить инициализацию каталога MCP, обращения по пользовательскому URL и рассылку manifest через IPC; сохранить DI/интерфейсы с пустым результатом. Не менять общие entrypoints, product/build/lockfiles, PDF/documents, терминал, authentication и API расширений. Полная сборка и релиз не запускались; main этим агентом не изменяется.

Уточнение области до правок: IPC manifest adapter включён в задание — удаление рассылки без него оставило бы ожидающий barrier. Канал временно сохраняется для совместимости старых callers, возвращает пустой результат без ожидания.

## Результат

- Platform manifest service заменён небольшим совместимым сервисом: статус `Unavailable`, оба getter возвращают `null`, события `Event.None`. Удалены построение URL, определение версии каталога через HTTP, product/request/log DI и cache.
- Browser workbench экспортирует тот же совместимый сервис под прежним именем. Удалены чтение `chat.mcp.gallery`, configuration listeners, dynamic status/events и отправка manifest на remote.
- Desktop сохраняет прежний export и DI token, но регистрация теперь delayed. Удалены shared-process dependency, получение IPC channel и отправка manifest/подписка на изменения. Общие entrypoints менять не требуется.
- Shared/server IPC adapter наследует тот же пустой контракт. Удалены barrier, mutable manifest и emitters. Getter больше не ждёт renderer и не может зависнуть из-за отсутствия его сообщения. Старый `setMcpGalleryManifest` принимается как пустое подтверждение: переданный каталог игнорируется и не включает сервис; неизвестные команды по-прежнему отклоняются.

Это удаление реализации и фоновых зависимостей, а не скрытие меню. Старые product/settings значения не возвращают manifest через эти сервисы. Общие request/network/auth services, пользовательские настройки и файлы не меняются.

## Совместимость и ограничения

`IMcpGalleryManifestService` и все существующие import paths сохранены. Имеющийся `McpGalleryService` без явного manifest сообщает `isEnabled() === false`, возвращает пустую query и отклоняет queryPage штатной ошибкой незаданного каталога. DI не требует product/configuration/request/remote/shared-process services для создания нового manifest service.

Сам `McpGalleryService` и его методы с явно переданным manifest/URL остаются: это отдельные пути, и данный патч не гарантирует отсутствие абсолютно всех запросов MCP. Discovery, серверные HTTP/SSE/stdio transports, MCP extension API, UI actions/settings, management/scanner и authentication не удалены. IPC compatibility channel всё ещё регистрируется в shared/server process. Полная MCP/AI-очистка и измерение памяти остаются будущей работой. Новый packaged runtime не запускался.

## Выполненные проверки

1. Целевой ESLint: все шесть runtime/test файлов пройдены; изменённый после проверки test повторно проверен.
2. Новые suites `src/vs/platform/mcp/test/common/mcpGalleryManifestService.test.ts` и `src/vs/workbench/services/mcp/test/electron-browser/mcpGalleryManifestService.test.ts`: 7/7 passed. Проверяют DI без инфраструктурных services, немедленный ответ IPC без клиента, игнорирование старого manifest без событий, пустую query/отказ queryPage без request и сохранение desktop DI registration. IPC-проверка использует timeout, чтобы поймать прежнее зависание.
3. Существующий `src/vs/platform/mcp/test/common/mcpGalleryService.test.ts`: 49/49 passed; выполнен вместе с тремя workbench tests (52/52 в том запуске). Product implementations не подменялись: тестовый bundle esbuild, репозиторный assert shim, Mocha в headless Chromium. Это целевой запуск исходных test suites, не штатный полный Electron runner и не native smoke приложения.
4. Узкая проверка TypeScript 6.0.2: шесть изменённых файлов с их транзитивными зависимостями и штатными declarations — 375 файлов, 0 diagnostics. Использованы options `src/tsconfig.json`, `noEmit`, explicit Node declarations перед `src/typings/*.d.ts`, затем шесть файлов. Первоначальный неполный набор declarations выявил отсутствие глобальных типов и обязательного `pageSize` в тесте; тест исправлен, финальная проверка включает все diagnostics без фильтрации. Full client typecheck не запускался.
5. `git diff --check`, проверка списка файлов и отсутствие изменений package/lockfiles. Зависимости установлены отдельно для этого worktree через закреплённый pnpm 12.16.0, frozen lockfile, ignore-scripts; чужие node_modules/out/.build не использовались.

## Передача интегратору

Резервирование выполнено до реализации: отчёт сразу создан в общем каталоге и коммит `583605eeb76` в своей ветке. Runtime/report commit определяется через `git log -1 --format=%H agent/mcp-gallery-disable`; он следует за reservation commit. Оба коммита используют GitHub noreply; hooks и настройки подписи не отключались.

Перенести ветку или её runtime commit целиком: четыре реализации и два новых теста должны попасть вместе, иначе прежний IPC barrier будет ждать уже удалённую рассылку. Дополнительного wiring, build allowlist и зависимостей нет. В общем checkout оставлена только собственная копия отчёта для видимого статуса; main branch/чужой код не изменены. При cherry-pick учесть эту копию, не перезаписывая отчёты других агентов.

На релизном пакете интегратор выполняет общий client typecheck и smoke desktop/web/remote потребителей: settings/accounts/extensions/Git/terminal/Tasks, отсутствие missing service/channel, отсутствие каталога при старом пользовательском URL. Выполнять вместе с остальными задачами, без отдельной полной сборки ради этого коммита. PDF/documents и terminal cleanup области не пересекаются.
