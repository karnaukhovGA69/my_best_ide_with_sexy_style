# mcp-native-discovery-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент ранее mcp-elicitation-disable и mcp-copilot-config-disable. Ветка: `agent/mcp-native-discovery-disable`. База: `59f0fde52ec`. Claim: `2e86b473414`; реализация и тесты: `bf60d2768e0`. Main и бинарный релиз не менялись.

## Область и результат

Только `src/vs/platform/mcp/node/nativeMcpDiscoveryHelperService.ts`, `src/vs/platform/mcp/test/node/nativeMcpDiscoveryHelperService.test.ts` и этот отчёт. Задача зарезервирована в общем checkout до реализации. Общие environment/shell/SSH services, IPC contracts/registrations/channel implementation, discovery contributions другого агента, main/build/dependencies не менялись.

Сохранены `NativeMcpDiscoveryHelperService`, два необязательных constructor arguments и `load(): Promise<INativeMcpDiscoveryData>`. Constructor больше не захватывает process.env по умолчанию, не читает и не хранит переданное окружение/resolver. Удалены os.homedir, чтение COPILOT_HOME/APPDATA/XDG_CONFIG_HOME, shell environment resolution, вычисление Copilot path и выдача discovery roots. `load` сразу отклоняется локализованной ошибкой недоступности MCP discovery; фиктивные directory URI и успешный пустой объект не возвращаются.

## Совместимость

Проверены все найденные runtime consumers в `src`: desktop main регистрирует SyncDescriptor с `(process.env, resolveShellEnvironment callback)`, remote server — без arguments. Оба пути остаются совместимы. Main по-прежнему передаёт ссылку на process.env в существующем shared wiring, но этот сервис её не читает/не сохраняет и callback не вызывает.

Старые native/remote workbench discovery callers обрабатывают rejected load: записывают warning и вызывают setDetails(undefined). Copilot configuration service ловит ошибку и возвращает undefined. Готовые отдельные discovery/config-disable ветки убирают и эти callers; переносить вместе в общий пакет предпочтительно, но требуемых code dependencies на них нет.

Main ProxyChannel и remote NativeMcpDiscoveryHelperChannel остаются зарегистрированы. Отказ проходит через них без выдачи discovery data. Remote channel всё ещё может получить обычный URI transformer до вызова load; сам channel не изменён. Полное снятие IPC registrations и удаление устаревших callers остаются интегратору.

## Проверки

- 6/6 Node tests через временный esbuild/Mocha harness реальных source modules: успешно, штатная проверка disposable leaks. Проверены default remote DI construction, desktop constructor arguments, запрет чтения/перечисления environment через Proxy traps, available/throwing/pending shell resolver, конкурентные запросы и отсутствие timers. Ни один resolver не вызывается.
- Один из шести тестов использует реальные ChannelClient/ChannelServer с in-memory message protocol: main ProxyChannel.fromService и неизменённый remote NativeMcpDiscoveryHelperChannel. Повторные load через обе proxy-стороны отклоняются правильным сообщением. Сеть/реальные IPC sockets/SSH не использовались.
- Контроль чувствительности четырёх тестов environment/resolver: подстановка исходного helper из `59f0fde52ec` в память bundler дала четыре ожидаемых падения. Старый helper читает environment и дважды вызывает resolver при двух запросах. Promise.allSettled заранее обрабатывает baseline rejection; pending-resolver сценарий проваливается по счётчику сразу и не зависает. Checkout не менялся, пользовательские файлы не изменялись.
- Узкий TypeScript noEmit двух TS-файлов с ambient declarations и транзитивными зависимостями: 673 файла графа, 0 diagnostics без фильтрации. Options из `src/tsconfig.json`, Node types явно подключены. Найденное сначала несоответствие тестового DisposableStore исправлено; окончательная проверка прошла.
- Целевой ESLint обоих TS-файлов, повторный lint изменённого теста и `git diff --check` прошли. Зависимости рабочего каталога переиспользованы. Launcher использовал pnpm 11.25.0 при закреплённом 12.16.0; package/lockfiles не менялись.

## Интегратору

Перенести `agent/mcp-native-discovery-disable` целиком либо implementation `bf60d2768e0` с отчётом. Ветка основана на main и независима от прежних task-веток. Новое wiring не требуется. На общем скомпилированном output выполнить `vs/platform/mcp/test/node/nativeMcpDiscoveryHelperService.test.js` штатным test runner.

В общем checkout незакоммиченная копия отчёта — наша резервация, обновлённая результатом. Если она мешает cherry-pick, сверить и заменить только этот файл версией task-ветки, сохраняя чужие отчёты.

Полный client/server typecheck, production package, native Electron, реальное remote/SSH-подключение и релиз не запускались по правилу пакетных сборок. Node unit/IPC tests не заменяют native smoke. Это отключение одного MCP discovery helper; другие источники home/environment и прочие MCP/AI paths не удалены. Отсутствие всей сетевой активности или экономия ресурсов не заявляются.
