# github-workbench-service-disable

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. Ветка: agent/github-workbench-service-disable. База: b73001809cd + github links/builtins cleanup.

Удалить core WorkbenchGitHubService authentication/client/cache/request-scope runtime в browser и native, сохранив IWorkbenchGitHubService/IGitHubService shape для оставшихся consumers. Область: src/vs/workbench/services/github/browser/githubService.ts, electron-browser/githubService.ts, test/browser/githubService.test.ts. Проверить consumers/ошибки и DI; явный unavailable отказ без sign-in/client/network. Общий authentication API, Git/SSH, platform/shared-process GitHub implementation, settingsTransfer и чужие задачи не входят. Если credentialProvider станет orphan, удаление отдельным резервом.

Расширение резерва до правок: test/electron-browser/githubService.test.ts — существующий direct constructor тест native adapter требует замены на unavailable-контракт.

Расширение резерва до правок после consumer audit: src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts (только GitHub service/channel registration), удаление orphan services/github/browser/githubCredentialProvider.ts и его test/browser/githubCredentialProvider.test.ts. Shared GitHub engine/protocol implementations остаются, общий auth API не меняется. В shared-process иначе оставалась eager GitHub queue/telemetry/config subscription даже без desktop client.

Документация в области: src/vs/platform/github/README.md — отметить неактивный workbench/shared-process wiring и убрать ссылку на удаляемый broker.

Workbench service теперь Disposable без DI/runtime engine: все client/scope acquisition methods явно отказывают с GitHubRequestError kind unknown (не authentication, вход не исправляет отключённую функцию), onDidChangeDefaultClient = Event.None. Native adapter не подключает shared client/credential channel. Удалены eager shared-process engine/channel registrations и orphan credential broker с его obsolete tests; source engine/protocol/platform adapter остаются. Общие authentication/extension API не менялись; специфичный proposed GitHub API получает unavailable от underlying service.

Проверки: 55 browser tests passed, 0 page errors (4 unavailable browser/native DI checks + existing MainThreadGitHub, commit/resource resolver suites). Первая попытка дала 2 layout failures, поскольку временный harness отбрасывал CSS; после включения настоящего CSS оба layout tests прошли без изменения product code. ESLint пяти изменённых TS файлов и diff --check прошли. Consumer search не находит старый credential broker; исправлена README ссылка. Full typecheck/package/native smoke остаются на интеграционный пакет.
