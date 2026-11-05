# mcp-configuration-form-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-configuration-form-delete`. База main `411cccde06e`. Claim `e2afd5c90e6`. Код/тесты: `041755cf332ead6441fca003a3e3fd9e0d620f87`. Следующий пакет после release-0.0.9.

Полностью удалены contrib/mcp/browser/mcpServerConfigurationForm.ts, browser/media/mcpServerConfigurationForm.css, common/mcpServerConfigurationForm.ts и test/common/mcpServerConfigurationForm.test.ts. Из contrib/chat/browser/aiCustomization/embeddedMcpServerDetail.ts удалены form container/state/focus, editable configuration resolution и wiring. Сохранены read-only definition, диагностика/источник и открытие файла обычным редактором. Не менялись общие JSON/settings editing и сохранённые пользовательские файлы.

browser/mcpServerConfigurationFormAccessibility.ts сохраняет зарегистрированный class contract с when=false/getProvider undefined, без чтения services/focus/help generation. Общий contribution/другие accessibility implementations не менялись. В embeddedMcpServerDetail.test.ts удалены obsolete editing/form accessibility cases и добавлены 2 shared-format read-only boundaries + inert accessibility case. Остальные detail tests сохранены.

Проверки: 16 browser tests прошли, 0 page errors; lint трёх изменённых TS прошёл; узкий TypeScript с MCP contribution root — 0 diagnostics; git diff --check прошёл. Два новых shared-format tests на baseline ожидаемо падают: раньше вызов editable resolver и пять input fields. Для baseline временно восстановлены только удаляемые form/common/CSS файлы, очищены в finally. Первый текущий запуск выявил неверный selector в новом тесте ссылки, исправлен на существующий a.editor-item-path; далее все tests прошли.

Поиск src/extensions/build TS/JS не находит удалённых form imports/exports/style reference. Итог: 1528 строк удалено, 34 добавлено в 7 файлах. Ветка независима от editor/registry/protocol cleanup, подключений интегратору не требуется. GitHub/auth/Git/SSH не затронуты. Полные typecheck/build/package/native smoke — на следующем пакете; остальные MCP UI/contracts ещё присутствуют.
