# mcp-sampling-log-disable

Статус: ГОТОВО к интеграции. Владелец: агент ранее mcp-native-discovery-disable и mcp-sampling-disable. Ветка: `agent/mcp-sampling-log-disable`. База: `59f0fde52ec`.

Область была помечена занятой до реализации. Коммит назначения: `edb8b7b8db2`. Коммит реализации и тестов: `d78889b7e13`.

## Изменения

Задачи A05/A07: удалены persistence и форматирование журнала MCP sampling — prompts/responses/model/timestamp, дневные счётчики, retention/ring buffer, ObservableMemento и его storage listeners. Класс больше не требует IStorageService, не читает сервер/запрос и не сохраняет payload в полях.

Сохранена совместимость методов: `has()` возвращает false, `get()` — undefined, `getAsText()` — пустую строку. `add()` — намеренный асинхронный no-op; он не отклоняет Promise, поскольку прежний McpSamplingService вызывает его без await. Это отключённая поверхность совместимости, а не реализация журналирования. Экспорт ISamplingStoredData оставлен для совместимости типа. Прежние записи `mcp.sampling.logs` не читаются, не показываются, не изменяются и не удаляются. Обычное storage не менялось.

Изменены только:

- `src/vs/workbench/contrib/mcp/common/mcpSamplingLog.ts`
- `src/vs/workbench/contrib/mcp/test/common/mcpSamplingLog.test.ts`
- этот отчёт.

## Проверки

- Целевой ESLint двух TS-файлов: пройден. Имеющийся launcher pnpm сообщил о неизвестном workspace-поле skills; зависимости и lockfiles не менялись.
- 4 теста McpSamplingLog: пройдены в Chromium через esbuild/Mocha; 0 page errors. Покрыты strict DI без storage, запрет любых обращений к storage через throwing Proxy, отсутствие чтения server/request до и после dispose, неизменность старых записей и отсутствие новых записей во всех четырёх StorageScope. Проверены пустое хранилище, корректная синтетическая запись и повреждённый JSON; обычное сохранение состояния работает.
- Существующий тест McpService `app request metadata does not change sampling policy outside chat`: пройден, 0 page errors. Прежний реальный McpSamplingService создаётся через DI и завершает разрешённые запросы с тестовым model service после удаления логирования.
- Проверка чувствительности: те же два storage-теста с исходным mcpSamplingLog.ts из базы ожидаемо падают на чтении storage и создании записи. Checkout для этого не изменялся.
- Узкая проверка TypeScript API: изменённый runtime, тест и прежний McpSamplingService с зависимостями; 1327 файлов графа, 0 диагностик. Это не полный client typecheck.
- `git diff --check`: пройден.

## Интегратору

Ветка независима от ранее подготовленной `agent/mcp-sampling-disable`: её runtime-файл другой, пересечения области нет. На текущем main ещё существует вызывающий McpSamplingService; с ним проверена совместимость. После включения ветки mcp-sampling-disable журнал перестанет создаваться этим сервисом, а данный патч дополнительно удаляет оставшийся механизм записи. Общие контракты, contributions, main, сборка и области других агентов не менялись.

Полные сборка/package, общий typecheck, native smoke и релиз здесь не запускались согласно правилу пакетной интеграции. Они остаются у интегратора; готовность ветки не означает включение в main или выпущенную сборку. Полное удаление AI/MCP и отсутствие всего фонового трафика этим изменением не заявляются.
