# github-native-adapters-delete

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/github-native-adapters-delete. База: main eab8fa4a00d с готовым github-workbench-service-disable.

Область до правок: src/vs/platform/github/electron-browser/githubService.ts, electron-utility/githubService.ts, electron-utility/githubFetch.ts и README.md. Удалить три orphan platform adapters после снятого workbench/shared-process wiring, исправить документацию отключённого desktop/browser binding. Общий Git/SSH/auth/network/proxy API, portable GitHub contracts/engine и Agent Host binding не менять. Проверить внешние imports перед удалением. Не менять root/build/entrypoints и текущий snapshot сборщика.
