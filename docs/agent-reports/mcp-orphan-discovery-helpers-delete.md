# mcp-orphan-discovery-helpers-delete

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-discovery-helpers-delete`. База: `98aa2b043b1`.

Зарезервированы для удаления следующие файлы внутри `src/vs/workbench/contrib/mcp/` (проверены: production imports отсутствуют; только собственные tests):

- `common/discovery/extensionMcpDiscovery.ts`
- `common/discovery/installedMcpServersDiscovery.ts`
- `common/discovery/nativeMcpRemoteDiscovery.ts`
- `common/discovery/workspaceDotMcpDiscovery.ts`
- `common/discovery/workspaceMcpDiscoveryAdapter.ts`
- `electron-browser/nativeMpcDiscovery.ts`
- `common/mcpEditorAffordanceState.ts`
- `common/mcpSamplingLog.ts`
- `common/mcpGatewayToolBrokerChannel.ts`
- `test/common/workspaceDotMcpDiscovery.test.ts`
- `test/common/mcpEditorAffordanceState.test.ts`
- `test/common/mcpSamplingLog.test.ts`
- `test/common/mcpGatewayToolBrokerChannel.test.ts`

Также зарезервирован этот отчёт. Удалить неиспользуемые discovery adapters и утилиты целиком; сохранить общие discovery registry, DI/service registrations и consumers. Не изменять GitHub auth/его окружение, Terminal/Tasks, общие HTTP/process/logging utilities и чужие области. Проверить оставшиеся MCP contribution и gateway tests, без полной сборки.

Расширение резерва до удаления: после снятия шести discovery adapters больше нет production consumers у `common/discovery/nativeMcpDiscoveryAbstract.ts`, `common/discovery/nativeMcpDiscoveryAdapters.ts` и их единственного `test/common/nativeMcpDiscoveryAdapters.test.ts`. Эти три файла внутри того же MCP каталога также заняты этим заданием и удаляются вместе с зависимыми листьями. Проверка search по src/extensions/build/scripts/test выполнена до изменения.
