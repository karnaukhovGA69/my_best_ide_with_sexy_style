# native-issue-upload-rpc-delete

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. База: main a483b299cd5; integration/after-local-0.0.9.

Область: src/vs/platform/native/common/native.ts, src/vs/platform/native/electron-main/nativeHostMainService.ts, src/vs/workbench/test/electron-browser/workbenchTestServices.ts, этот отчёт. Удалить orphan uploadFileViaMobileApi после принятого github-issue-upload-disable: interface, main implementation, test stub. Остальной native host, screenshots, Git/SSH/auth/catalog не менять. Проверить отсутствие consumers до/после, lint и общий typecheck вместе со следующим интеграционным пакетом. Package не запускать.
