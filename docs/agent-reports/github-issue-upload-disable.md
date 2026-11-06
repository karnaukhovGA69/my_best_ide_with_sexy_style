# github-issue-upload-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. База: main 354801b3e94. Ветка: agent/github-issue-upload-disable.

Область: contrib/issue/browser/githubUploadService.ts, electron-browser/nativeGitHubUploadService.ts, новый test/browser/githubUploadService.test.ts. Сохранить API signatures и DI IDs, заменить GitHub upload/repository lookup на явный unavailable без auth/files/network. Общий nativeHost interface/implementation, issue UI, auth и Git/SSH не менять. Проверить strict DI и отказ без чтения входных данных; тесты потребителей сохранить.
