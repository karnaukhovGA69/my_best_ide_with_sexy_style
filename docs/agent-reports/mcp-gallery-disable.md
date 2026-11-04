# mcp-gallery-disable

Статус: ЗАНЯТО / в работе. Владелец: агент mcp-audit. Ветка: `agent/mcp-gallery-disable`. База: `01293638a167e4d1b6da6036bd396ab81a2f6780`.

Зарезервировано до реализации: `src/vs/platform/mcp/common/mcpGalleryManifestService.ts`, `src/vs/platform/mcp/common/mcpGalleryManifestServiceIpc.ts`, `src/vs/workbench/services/mcp/browser/mcpGalleryManifestService.ts`, `src/vs/workbench/services/mcp/electron-browser/mcpGalleryManifestService.ts`, целевые новые тесты этих сервисов и этот отчёт. Не назначать второго владельца этой области.

Цель: исключить инициализацию каталога MCP, обращения по пользовательскому URL и рассылку manifest через IPC; сохранить DI/интерфейсы с пустым результатом. Не менять общие entrypoints, product/build/lockfiles, PDF/documents, терминал, authentication и API расширений. Полная сборка и релиз не запускаются. Итоговые проверки и ограничения будут записаны после реализации.

Уточнение области до правок: IPC manifest adapter включён в задание — удаление рассылки без него оставило бы ожидающий barrier. Канал временно сохраняется для совместимости старых callers, возвращает пустой результат без ожидания.
