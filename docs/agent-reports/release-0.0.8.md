# release-0.0.8

Статус: ЗАНЯТО / интеграция и релиз. Владелец: агент ранее mcp-cli-disable, по прямому поручению пользователя выпустить все изменения. Ветка: `integration/release-0.0.8`. База: `59f0fde52ec24314727b0d145b21729f2ab13bd6`.

Зарезервированы интеграция готовых task-веток, разрешение конфликтов, общие подключения/build allowlist, совместимость, пакетные проверки, main и выпуск v0.0.8-preview для macOS ARM64. Не запускать параллельную сборку/релиз этого пакета. Активные каталоги других агентов не менять. Старый terminal cleanup объединяется с его refresh; аудит включается как документация.

Состав зафиксирован до интеграции:

- `agent/ai-terminal-cleanup` — `a8f6ce1911c498e32a7da7055f8405df177544b9`
- `agent/ai-terminal-cleanup-refresh` — `a5eddab10575be7bd2d7499746d128c5059cde08`
- `agent/chat-dictation-service-disable` — `f536e9f7de426d725968721f9b2bb21dbfb0abe7`
- `agent/documents-ui` — `63864b464a1361d1525150f876c3b3c4bda51f60`
- `agent/keyword-activation-disable` — `a186d8a57e8a61633483f6751a5a2f14664bd60d`
- `agent/legacy-voice-chat-disable` — `98e705bb316f4c5ace537adfa9a2f68d63133229`
- `agent/mcp-api-disable` — `ef2d489a5b758a3beb2ca350ea7170fbe3ed9cbb`
- `agent/mcp-audit` — `68c9184b687167015c6c06d3232b38c0847bf369`
- `agent/mcp-cli-disable` — `3890aa9018ad5b7e63e5a90ce9649ae797a1c0bd`
- `agent/mcp-context-ui-remove` — `af6570f582c2e07b14bca06d4a8a97b970426e12`
- `agent/mcp-copilot-config-disable` — `06df903daeaa116ef5e1ae908b80f1e73108b4b8`
- `agent/mcp-devmode-disable` — `60ed6b2ec42c53b5df2c288ff2bbf0ced77f6767`
- `agent/mcp-discovery-disable` — `2261f494aa3d27e413b6f345e434d6101775f6c9`
- `agent/mcp-elicitation-disable` — `2d4712359676e753ac7dac8e6cd2318d6ebdb56e`
- `agent/mcp-gallery-disable` — `d131e472b281d6f71d9fc70d8aa72fc92448ea79`
- `agent/mcp-language-features-remove` — `065745fcb942301208d7b3480ef662dce5095d65`
- `agent/mcp-migration-disable` — `24a76eb7b8829409ecf701c85b66a73fe1cf2bf8`
- `agent/mcp-native-discovery-disable` — `c939294712e48685527a05a9f1ac58a88b52e27c`
- `agent/mcp-platform-gateway-disable` — `d605c3a7ddd4b4c31fb019e880fc401492363a6a`
- `agent/mcp-resource-filesystem-disable` — `fd05c578230ec5785591fbd6ba6d8b9feb71c8b0`
- `agent/mcp-sampling-disable` — `d32619a362459775893ec7c1ade9f41886ca9f5a`
- `agent/mcp-sampling-log-disable` — `0fd6f1800325d1563d611ce5c7c88fc84b289add`
- `agent/mcp-sandbox-launch-remove` — `d0b2d94258e50fd30978e45932636b9ef16af0e5`
- `agent/mcp-tool-broker-remove` — `af6f69a43520473f14964bbcbc7bec5e3ad4aa06`
- `agent/mcp-tool-contribution-disable` — `12af02abe84b966b0dfa6c0ebd6de8359d9dce8e`
- `agent/mcp-workbench-gateway-disable` — `2370f735dd82ee2b62966e93d8723250a98cc4c9`
- `agent/mcp-workbench-inventory-remove` — `4554d3d1a195575dd9032b63913def0e180cb8fb`
- `agent/voice-client-transport-disable` — `f830cb25ccca74f74f8b94a8b475920cfcac988d`
- `agent/voice-live-session-disable` — `20fe54f0cd3749afb0bbb6c01103de649f0df775`
- `agent/voice-playback-disable` — `3fa644766d508e8d729c73731e6d8f0d402b1acc`
- `agent/voice-session-controller-disable` — `1ac87831161b054bb94e14f53a477dc0b2e6c94b`
- `agent/voice-tool-dispatch-disable` — `238fa7b9d3a39792e319b6da89886856ab0ff1ec`
- `agent/voice-transcription-transport-disable` — `4fe165a5eb60f5c189b4c2c6db644c339ffa16c2`
