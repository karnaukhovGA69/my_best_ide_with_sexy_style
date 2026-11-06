# github-issue-upload-disable

Статус: ГОТОВО к интеграции. Владелец: чат упрощения Myself IDE. База: main 354801b3e94. Ветка: agent/github-issue-upload-disable.

Область: contrib/issue/browser/githubUploadService.ts, electron-browser/nativeGitHubUploadService.ts, новый test/electron-browser/githubUploadService.test.ts. Сохранить API signatures и DI IDs, заменить GitHub upload/repository lookup на явный unavailable без auth/files/network. Общий nativeHost interface/implementation, issue UI, auth и Git/SSH не менять. Проверить strict DI и отказ без чтения входных данных; тесты потребителей сохранить.

Проверка adapters находится в electron-browser слое: browser test не должен импортировать native adapter.

Результат: удалены repository fetch, токеновые headers, передача bytes в native host и upload logging. Browser/native adapters теперь явно отклоняют оба метода с локализованным unavailable сообщением; native adapter не имеет DI dependencies и наследует browser contract. Методы/ID сохранены для оставшихся issue consumers, общий auth и Git/SSH не менялись.

Проверки: 54 tests passed в esbuild/Chromium/Mocha harness (4 новых adapter tests + 50 issueFormService tests), 0 page errors. Strict DI проверяет отсутствие native host/log/auth зависимостей; Proxy массива файлов выявляет попытки чтения/итерации данных. Scoped TypeScript 4 source/test файла: 0 diagnostics. ESLint 3 изменённых TS и git diff --check passed. При первой проверке исправлены типы тестовых fixtures и размещение native теста в electron-browser; финальный запуск выполнен после исправлений. Полный typecheck/build/native smoke не запускались, выполняются пакетно интегратором.

Следующий шаг для владельца общего native API: после этого изменения uploadFileViaMobileApi остаётся только в platform/native/common/native.ts, platform/native/electron-main/nativeHostMainService.ts и workbench/test/electron-browser/workbenchTestServices.ts, без production callers. Удаление этого RPC/implementation отдельно, общие файлы в текущей задаче не менялись. Отсутствие всех сетевых GitHub путей во всём форке не заявляется. Включение ветки не требует wiring.
