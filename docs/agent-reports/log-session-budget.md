# log-session-budget

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE, отдельная ветка agent/log-session-budget от main 5f88b8b3d41.

Область: src/vs/platform/log/node/diagnosticLogSessionRetention.ts (новый), src/vs/platform/log/test/node/diagnosticLogSessionRetention.test.ts (новый), src/vs/code/electron-utility/sharedProcess/contrib/logsDataCleaner.ts и этот отчёт. Задача: ограничить суммарный размер сохранённых desktop log sessions, очищать старые сеансы по возрасту/объёму, не трогать текущий сеанс, историю и внешние файлы. Очистка однократно после запуска, без постоянного сборщика. Активные файлы сохраняют поканальную ротацию; строгий лимит любого Output/расширения не заявляется.

MCP/voice/documents, GitHub OAuth/catalog/backup, общие entrypoints/dependencies/build/main не входят в область. Полный build/release не запускается; после целевых проверок передать интегратору.
