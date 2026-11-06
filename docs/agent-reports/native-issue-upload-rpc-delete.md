# native-issue-upload-rpc-delete

Статус: ИСХОДНЫЕ ИЗМЕНЕНИЯ ГОТОВЫ, ожидается пакетный typecheck. Владелец: интегратор/documents agent. База: main a483b299cd5; integration/after-local-0.0.9.

Область: src/vs/platform/native/common/native.ts, src/vs/platform/native/electron-main/nativeHostMainService.ts, src/vs/workbench/test/electron-browser/workbenchTestServices.ts, этот отчёт. Удалить orphan uploadFileViaMobileApi после принятого github-issue-upload-disable: interface, main implementation, test stub. Остальной native host, screenshots, Git/SSH/auth/catalog не менять. Проверить отсутствие consumers до/после, lint и общий typecheck вместе со следующим интеграционным пакетом. Package не запускать.

Удалены 80 строк: контракт RPC, main-process policy/S3/confirm upload и test stub. До удаления поиск src/build/test/extensions находил только эти три определения; после удаления RPC/endpoint/старый multipart marker отсутствуют. ESLint трёх файлов и diff --check passed. Screenshots/clipboard/process API и их VSBuffer imports сохранены. Общий typecheck выполняется в шестом интеграционном срезе; отдельный package/native не запускался.
