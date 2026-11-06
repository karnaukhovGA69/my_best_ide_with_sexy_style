# github-native-adapters-delete

Статус: ГОТОВО к интеграции. Владелец: чат упрощения Myself IDE. Ветка: agent/github-native-adapters-delete. База: main eab8fa4a00d с готовым github-workbench-service-disable.

Область до правок: src/vs/platform/github/electron-browser/githubService.ts, electron-utility/githubService.ts, electron-utility/githubFetch.ts и README.md. Удалить три orphan platform adapters после снятого workbench/shared-process wiring, исправить документацию отключённого desktop/browser binding. Общий Git/SSH/auth/network/proxy API, portable GitHub contracts/engine и Agent Host binding не менять. Проверить внешние imports перед удалением. Не менять root/build/entrypoints и текущий snapshot сборщика.

Результат: удалены все три неиспользуемых platform native adapters, включая delayed singleton registration, shared-process credential channel/client и GitHub-specific proxy-aware fetch. В README добавлено видимое описание отключённой функции, исправлены desktop/browser execution и networking разделы, убраны ссылки на удалённые файлы. Portable engine/protocol и Agent Host source consumers остаются: полное удаление всех GitHub исходников не заявляется.

Проверки: разрешение относительных imports/from/dynamic import/require в src/build/test/extensions подтвердило 0 внешних imports и одну внутреннюю связь между удаляемыми файлами. Сохранённые browser/native WorkbenchGitHubService suites: 4/4 tests passed, 0 page errors; проверены strict DI без auth/network/shared-process и unavailable отказ без чтения credentials. Узкая TypeScript-проверка этих четырёх source/test файлов: 0 diagnostics. git diff --check прошёл. Новых/изменённых TS файлов нет, только удаления; lint не запускался. Общая интеграционная проверка и native smoke выполняются пакетно сборщиком, текущие inputs его сборки не менялись.

Интегратору: принять ветку целиком, дополнительный wiring не требуется. Generic proxy-agent dependency не удалять: она используется другими сетевыми службами. Общие authentication API и обычный Git/SSH сохранены.
