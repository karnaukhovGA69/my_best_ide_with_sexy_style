# Build and branch cleanup 2026-11-06

Статус: ЗАНЯТО. Владелец: чат new-chat / MCP. Прямое поручение пользователя: разобрать ветки/коммиты, удалить старые ветки и сделать билд.

Область: удаление только локальных веток, уже полностью слитых в main и не занятых worktree; отчёт с SHA удалённых ссылок. Неслитые и занятые ветки сохраняются. Удаление remote branches не выполняется.

Сборка: после завершения активного integration-post-0.0.9 третьего среза и его typecheck взять зафиксированный main в собственный worktree myself-mcp-audit. Полный package/build/sign/privacy/native checks принадлежат этому заданию; не запускать параллельный package. Существующий release-0.0.9 и его бинарник не перезаписывать. Main и активную интеграцию другого агента не менять.

Удалены 60 слитых локальных task-веток через git branch -d. Все SHA являются предками main 6b9e5232b93; занятые worktree исключены. Remote refs не изменены.

- `agent/ai-edit-telemetry-runtime-disable` → `a441bacdeb2a924ab079c9c633243fa4f0f5f6b4`
- `agent/ai-search-services-disable` → `48a0fc6440ac66b25aa6471655e6386293508e0e`
- `agent/dictation-actions-disable` → `55cd4cc6d46c85f7a6f9b5870617a7497c83cdeb`
- `agent/dictation-indicators-disable` → `7aef48ac1065f569109b5e33654d2bd5d119bd3d`
- `agent/dictation-onboarding-disable` → `f767a32556ab7fffce930213defe3e155da3fdb1`
- `agent/dictation-orphan-language-delete` → `1e2e7d39697a3f192e1ff9620cfbedcc6a12476c`
- `agent/documents-save-as` → `81efa000a9fc1742739d6f3700703ce3a5b486c4`
- `agent/documents-unicode-find` → `5f88b8b3d4171b8f269739da1e1e9c5c52fcb5a3`
- `agent/edit-statistics-startup-disable` → `3162e9b572d37d717611858472061dbc42edfe57`
- `agent/editor-dictation-session-disable` → `61448a78c6c288aeda60e3de7d43a0925c7752b4`
- `agent/editor-playground-remove` → `4c9d2745b769597fbe8b5568b12b06a2b01c2873`
- `agent/editor-telemetry-forwarding-disable` → `663370182addf937e014a7cb5ef8a22d8b507e08`
- `agent/experimentation-service-runtime-disable` → `d3892382c8621fb70af645597ffd5e2c7f0cd865`
- `agent/external-terminal-menu` → `9e76c0f1199754155edb6b7e4c3e5213130150ec`
- `agent/github-builtins-remove` → `d61187551e561f0661049df351774dc76ccae665`
- `agent/github-link-presentations-remove` → `153c1b5174c3a08b339d67aa57b4bfab568daf31`
- `agent/github-workbench-service-disable` → `4126adc2578e97708f8fb961a3376d8c778e706c`
- `agent/ide-updater-disable` → `178d96e01f6463183effef28f553cbf1fbaadf7b`
- `agent/inline-completions-runtime-disable` → `7b735c9cdcf81f98bce6ff3e2e45140f618d3ddf`
- `agent/inline-completions-service-disable` → `00c3c8e95653242752ba30a1344af07cf2184d54`
- `agent/inline-suggestion-settings-remove` → `f18339b13bb9ef35188dd3563be23c138b1da209`
- `agent/log-session-budget` → `135df60cc551bef1d8de280a8cc47607ec3c27bb`
- `agent/mcp-app-transport-remove` → `d7b3566c564ea163f3fe892df4de46f85114aeb3`
- `agent/mcp-chat-prompt-action-remove` → `0e9e1e83df5a0433281c56e38cc67d047690b696`
- `agent/mcp-client-task-remove` → `9b9446e26fed03dcda305e376004648d1d541134`
- `agent/mcp-install-wizards-remove` → `377d91ba4127f52964eac371691494a55bb82856`
- `agent/mcp-orphan-discovery-helpers-delete` → `dcb59bc2857433a2504187cd912e5dfb427c5d77`
- `agent/mcp-orphan-prompt-picker-delete` → `168e887cd054d681dd3bcc54010068e4fba26242`
- `agent/mcp-orphan-server-delete` → `ec83293f13e3ed21b7752200fdc7be0e6b4d8a40`
- `agent/mcp-orphan-transports-delete` → `0928076a2e5894969ef57f1161f4a0c333fdf6a8`
- `agent/mcp-prompt-arguments-remove` → `3207f229ea493c37d14204254e1ad156d9d0d4ee`
- `agent/mcp-resource-quickaccess-remove` → `e668bf7117b7536604fdd093eb011bf5ea16326e`
- `agent/mcp-runtime-service-remove` → `7ef1eecb9a22bb91508acf31528b59f8f9765ea4`
- `agent/mcp-server-connection-remove` → `3336543f82f7d3868745f603299520a31625af49`
- `agent/mcp-server-icons-remove` → `0da2837d958439ece2695b3cd06c0484ea35469b`
- `agent/mcp-task-manager-remove` → `fefe3d790f16478b034325cf67a1724c060c571a`
- `agent/mcp-workbench-inventory-remove` → `4554d3d1a195575dd9032b63913def0e180cb8fb`
- `agent/settings-file-portability` → `9d3f6035dab67af4afd98ac8a927bd8ef3cb87de`
- `agent/settings-search-local-only` → `88811e83e8198b150c0ac2c1776ce4dacabc4d32`
- `agent/survey-contributions-remove` → `1edac29d317b522dccc7031da6ae91e6c7125645`
- `agent/terminal-dictation-runtime-disable` → `7e1a78c56b60ced5a56472f002eb7036d492edd2`
- `agent/voice-glow-runtime-disable` → `76860d5c1a762b0b35679777fe17942237ecda32`
- `agent/voice-input-affordances-disable` → `bf5758933786163ca291e4f00e65153337fbbb14`
- `agent/voice-input-mode-disable` → `93607acb97704392307a49dac978b48fff80fba9`
- `agent/voice-input-submission-disable` → `269dfdcefd221f88090eb5db54ae4f71f77d84a0`
- `agent/voice-instructions-actions-disable` → `f86b69a6a9374575bbf2f3f05ca80c8489444a21`
- `agent/voice-mic-capture-disable` → `ebf83afb5fb0d6b39660095d85b437df1bc0b4a2`
- `agent/voice-onboarding-disable` → `9646d947f6535ca69dabf27ab6d2224a1f71bac3`
- `agent/voice-orphan-components-delete` → `bb239c3f9e68c0d165887258f891b7dd1077b3fd`
- `agent/voice-orphan-endpoint-delete` → `001095e977e1a1bed376071ab4d271700582a4b9`
- `agent/voice-orphan-hover-styles-delete` → `e61c3579a56ca34c09673614f4cbc41365377bde`
- `agent/voice-orphan-onboarding-assets-delete` → `a37b68430a2f0b769a39025e9b9299b91e22235c`
- `agent/voice-orphan-styles-delete` → `1626cf9ed9627e503eb9219545fdf491488011a4`
- `agent/voice-session-controller-disable` → `1ac87831161b054bb94e14f53a477dc0b2e6c94b`
- `agent/voice-toolbar-views-disable` → `cef2a86b0eb5c17e42fa2b868481b0d7ad823040`
- `agent/voice-tts-playback-disable` → `138fed4fcc67ae5175be4ab22920b1e0fc78be51`
- `agent/voice-widget-binding-disable` → `2fd4c20701cb750f47f14f55eb310a206cd43616`
- `agent/voice-window-picker-disable` → `dfd84fb6136381e99c7bb048d944c36ff55119d4`
- `agent/walkthrough-progress-disable` → `c440fbac58c918b01755bf2979a8e16ec3d806bd`
- `agent/welcome-ui-startup-remove` → `3a029bfd362c0512927a069187f27ae9328acbb9`

Build snapshot: интеграционный срез 379a3ea0067, общий client typecheck интегратора завершился с exit 0. Зафиксирована сборка этого среза, без последующих задач. Пользователь явно запросил билд.

После интеграции третьего среза удалены ещё 12 слитых локальных веток:
- `agent/mcp-action-rendering-runtime-remove` → `436c49b9b5cb3b7fe4ab8ef668f42282772c8e5d`
- `agent/mcp-browse-prompt-commands-remove` → `fd17f274e9fef520f137f58946bc32fdf447f255`
- `agent/mcp-configuration-form-delete` → `9de58123a971ee920e7bd2b69651f687dad49895`
- `agent/mcp-install-actions-runtime-remove` → `75be99455c85ff758ccd1560cf6229319f2b693f`
- `agent/mcp-lifecycle-commands-remove` → `fc4896bf9f6404ef78d2881c89361a9a61066eb6`
- `agent/mcp-orphan-connection-tasks-delete` → `f32b7e8956376bc786bc928c2243e91424ff8eb2`
- `agent/mcp-plugin-discovery-delete` → `f4d8aaf1bf50a87590c1228314aaededb44f22ab`
- `agent/mcp-registry-runtime-remove` → `32b4007ec4cc9be84190ccef2db011a2e8bbbde5`
- `agent/mcp-request-handler-runtime-delete` → `b970a3691b51dc7cb1c3bf2f71e740301940c6d7`
- `agent/mcp-server-controls-runtime-remove` → `4098428f5c30f38828eaba472f57035e06d64c72`
- `agent/mcp-server-editor-runtime-remove` → `5058199e010d71634a4a24daba2a0f83a4fe386a`
- `integration/next-package` → `411cccde06e843fac42e170ccf749f7784c7f7e3`

Обнаружен подтверждённый packaging defect: native documents log сообщает Webview.loadLocalResource для отсутствующего out/webview/editor.js; bundle лежит в webview/editor.js. ЗАНЯТО исправление extensions/myself-documents/esbuild.webview.mts и новый test/packaging.test.cts. Общий build helper сохраняет только basename outdir при --outputRoot. Исправление сохранит единый out/webview/editor.js для dev и production.
