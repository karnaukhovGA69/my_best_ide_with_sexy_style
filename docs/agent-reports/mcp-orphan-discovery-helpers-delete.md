# mcp-orphan-discovery-helpers-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-discovery-helpers-delete`. База: `62f2cc32a7c`. Claim: `e33553c90f8`; расширение резерва перед правками: `4dd00752ed7`. Код: `b77fb7d2ec4de90c844c786c6620550f3648a920`.

Полностью удалены 16 неиспользуемых файлов:

- `src/vs/workbench/contrib/mcp/common/discovery/extensionMcpDiscovery.ts`
- `src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts`
- `src/vs/workbench/contrib/mcp/common/discovery/nativeMcpDiscoveryAbstract.ts`
- `src/vs/workbench/contrib/mcp/common/discovery/nativeMcpDiscoveryAdapters.ts`
- `src/vs/workbench/contrib/mcp/common/discovery/nativeMcpRemoteDiscovery.ts`
- `src/vs/workbench/contrib/mcp/common/discovery/workspaceDotMcpDiscovery.ts`
- `src/vs/workbench/contrib/mcp/common/discovery/workspaceMcpDiscoveryAdapter.ts`
- `src/vs/workbench/contrib/mcp/common/mcpEditorAffordanceState.ts`
- `src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts`
- `src/vs/workbench/contrib/mcp/common/mcpSamplingLog.ts`
- `src/vs/workbench/contrib/mcp/electron-browser/nativeMpcDiscovery.ts`
- `src/vs/workbench/contrib/mcp/test/common/mcpEditorAffordanceState.test.ts`
- `src/vs/workbench/contrib/mcp/test/common/mcpGatewayToolBrokerChannel.test.ts`
- `src/vs/workbench/contrib/mcp/test/common/mcpSamplingLog.test.ts`
- `src/vs/workbench/contrib/mcp/test/common/nativeMcpDiscoveryAdapters.test.ts`
- `src/vs/workbench/contrib/mcp/test/common/workspaceDotMcpDiscovery.test.ts`

Удалены старые extension/installed/workspace/native discovery adapters, их общая файловая реализация, editor-affordance helper, уже неиспользуемые compatibility classes sampling log/tool broker и собственные tests этих модулей. После снятия листовых adapters native abstract/adapters больше не имели production consumers, поэтому также удалены в том же задании после расширения резерва. Другие registry/service registrations, общие platform process/log/http utilities, GitHub auth/его окружение и обычные Terminal/Tasks не изменены.

Проверки: static import scan и rg по src/extensions/build/scripts/test подтвердили отсутствие оставшихся ссылок на удалённые modules. Первую попытку вспомогательного сканера остановила тестовая директория с суффиксом .ts; после проверки is_file сканер завершился без ссылок. 2 существующих browser tests загрузки mcp.contribution прошли (пустой discovery registry, сохранённые IMcpRegistry/IMcpService DI registrations). 4 существующих browser gateway-disabled tests прошли; page errors нет. Последующее удаление native abstract/adapters затрагивает только замкнутую группу без внешних imports; успешные runtime checks переиспользованы. git diff --cached --check прошёл. Lint/typecheck удалённых файлов, full build/package не запускались.

Интегратору: независимая ветка, удаление не требует новых registrations. Общие typecheck/build/native smoke остаются на пакет. Существующие активные MCP service/server/registry implementations не входят в эту задачу; полное удаление MCP/AI не заявляется.
