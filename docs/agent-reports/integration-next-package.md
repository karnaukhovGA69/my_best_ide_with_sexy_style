# integration-next-package

Статус: ЗАНЯТО. Владелец: интегратор, по поручению пользователя работать непрерывно. GitHub-авторизацию, каталог GitHub и backup не менять.

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
