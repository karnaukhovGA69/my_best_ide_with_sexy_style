# integration-next-package

Статус: ЗАНЯТО. Владелец: интегратор, по поручению пользователя работать непрерывно. Решение уточнено владельцем 6 ноября: собственные GitHub OAuth/catalog/backup отменены; специфичные модули можно удалять после проверки потребителей. Общие Git/SSH/authentication API сохраняем; перенос настроек через файл занят другим агентом.

Первый срез пакета (documents-save-as/unicode-find уже в main):
- `agent/editor-playground-remove` — `4c9d2745b769597fbe8b5568b12b06a2b01c2873`
- `agent/mcp-resource-quickaccess-remove` — `e668bf7117b7536604fdd093eb011bf5ea16326e`
- `agent/mcp-prompt-arguments-remove` — `3207f229ea493c37d14204254e1ad156d9d0d4ee`
- `agent/voice-tts-playback-disable` — `138fed4fcc67ae5175be4ab22920b1e0fc78be51`
- `agent/voice-mic-capture-disable` — `ebf83afb5fb0d6b39660095d85b437df1bc0b4a2`

Область: интеграция готовых веток, необходимые совместимые исправления, общие проверки/main; отдельные задачи резервируются собственными отчётами. Активные MCP/voice/log области не редактировать. Полная сборка выполняется на накопленном пакете.

Первый срез объединён без конфликтов. Полный client typecheck прошёл; совместный browser-прогон пяти модулей: 28 tests passed, 0 page errors. Documents ранее проверены отдельно: 16 tests. Playground ESLint прошёл. История task-веток сохранена. Пакет переносится в main; бинарная сборка/native smoke и релиз ещё впереди, работа продолжается.

Второй срез: walkthrough-progress-disable и welcome-ui-startup-remove, плюс готовые ветки:
- `agent/log-session-budget` — `135df60cc551bef1d8de280a8cc47607ec3c27bb`
- `agent/mcp-chat-prompt-action-remove` — `0e9e1e83df5a0433281c56e38cc67d047690b696`
- `agent/mcp-app-transport-remove` — `d7b3566c564ea163f3fe892df4de46f85114aeb3`
- `agent/voice-onboarding-disable` — `9646d947f6535ca69dabf27ab6d2224a1f71bac3`
- `agent/voice-window-picker-disable` — `dfd84fb6136381e99c7bb048d944c36ff55119d4`
- `agent/voice-widget-binding-disable` — `2fd4c20701cb750f47f14f55eb310a206cd43616`

Второй срез объединён без конфликтов. Полный client typecheck прошёл; 134 browser tests в 12 модулях, 13 Node tests retention, 0 page errors. В тестовом harness устранено пересечение Playwright polling с запретом requestAnimationFrame в voice tests: runner теперь запускает Mocha после инициализации automation context. Это изменение внешнего harness, не продукта. Проверки документов (16) переиспользованы — исходники не менялись.

Обновлены AGENTS/README/project-plan/handoff/development-plan по подтверждённому здесь решению владельца об отказе от GitHub-модуля и переносе настроек файлом. GitHub-specific source пока не менялся. Полный binary/native цикл ещё не выполнен для нового пакета; работа продолжается.

Третий срез (в работе): survey-contributions-remove `1edac29d317`, ide-updater-disable `178d96e01f6`, плюс проверенные task snapshots:
- `agent/dictation-actions-disable` — `55cd4cc6d46c85f7a6f9b5870617a7497c83cdeb`
- `agent/dictation-onboarding-disable` — `f767a32556ab7fffce930213defe3e155da3fdb1`
- `agent/editor-dictation-session-disable` — `61448a78c6c288aeda60e3de7d43a0925c7752b4`
- `agent/inline-completions-runtime-disable` — `7b735c9cdcf81f98bce6ff3e2e45140f618d3ddf`
- `agent/mcp-client-task-remove` — `9b9446e26fed03dcda305e376004648d1d541134`
- `agent/mcp-orphan-discovery-helpers-delete` — `dcb59bc2857433a2504187cd912e5dfb427c5d77`
- `agent/mcp-orphan-transports-delete` — `0928076a2e5894969ef57f1161f4a0c333fdf6a8`
- `agent/mcp-server-icons-remove` — `0da2837d958439ece2695b3cd06c0484ea35469b`
- `agent/mcp-task-manager-remove` — `fefe3d790f16478b034325cf67a1724c060c571a`
- `agent/voice-input-affordances-disable` — `bf5758933786163ca291e4f00e65153337fbbb14`
- `agent/voice-input-mode-disable` — `93607acb97704392307a49dac978b48fff80fba9`
- `agent/mcp-install-wizards-remove` — `377d91ba4127f52964eac371691494a55bb82856`

Состав третьего среза закрыт: дальнейшие новые задачи входят в следующий срез. До последних двух веток 198 browser tests passed, 0 page errors; дополнительные suite и общий typecheck запускаются сейчас.

Третий срез проверен: 198 browser tests основного набора + 64 дополнительных (MCP install/voice input), 0 failures/page errors. Полный client typecheck прошёл. Node retention 13 tests и documents 16 tests не повторялись, их исходники неизменны. MCP connection suite baseline Canceled из task report остаётся отдельно отмеченным ограничением; он не выдаётся за чистый успешный прогон. Новые service/registration проверки успешны; общий package/native/signing ещё впереди.
