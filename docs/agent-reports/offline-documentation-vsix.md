# offline-documentation-vsix — ресурсный пакет официальной документации

Статус — готов к ревью. Ветка `agent/offline-documentation-vsix`, база `origin/main` на `8c5155c82de`. Подготовительный этап [#9](https://github.com/karnaukhovGA69/my_best_ide_with_sexy_style/issues/9).

## Изменения

- `build/package-offline-documentation.ts` собирает локальный VSIX `myself.offline-documentation@0.1.0` с `extensionKind: ["ui"]`. Источник — дерево `HEAD:extensions/myself-documents/documentation`. До этой правки официальные материалы можно было получить только в составе встроенного расширения. Теперь тот же снимок можно отдельно собрать и установить как VSIX. Подключение к библиотеке и исключение дубликата из `.app` входят в следующий этап после [#11](https://github.com/karnaukhovGA69/my_best_ide_with_sexy_style/issues/11).
- Упаковщик сверяет регистр путей, состав каталога, режимы файлов и хэши. После упаковки проверяет точный список файлов, побайтовое совпадение с подготовленным деревом и отсутствие путей среды сборки. Успешная сборка создаёт архив и файл `.sha256` в `.build/vsix`.
- `build/lib/test/packageOfflineDocumentation.test.ts` проверяет содержимое манифеста и архива, игнорирование локальных изменений, отказ при несовпадении регистра или хэша, лишней статье и симлинке. После отказа предыдущий архив и контрольная сумма сохраняются.

## Результаты проверок

macOS ARM64, Node 26.8.2, VSCE 3.6.1 из зависимостей репозитория. Целевой TypeScript выполнен на 7.0.2 из установленного комплекта инструментов. Использован существующий Nerded Code 1.146.0, коммит `3dbf0296716`. Сборка всего приложения и запуск окна IDE не выполнялись.

```sh
node build/package-offline-documentation.ts
node --test build/lib/test/packageOfflineDocumentation.test.ts
node build/eslint.ts build/package-offline-documentation.ts build/lib/test/packageOfflineDocumentation.test.ts
node_modules/.bin/tsc --ignoreConfig --target es2024 --module nodenext --allowImportingTsExtensions --noEmit --strict --skipLibCheck --verbatimModuleSyntax --erasableSyntaxOnly build/lib/typings/chromium-pickle-js.d.ts build/package-offline-documentation.ts build/lib/test/packageOfflineDocumentation.test.ts
git diff --check
(cd .build/vsix && shasum -a 256 -c myself.offline-documentation-0.1.0.vsix.sha256)
```

Тест, ESLint, проверка типов и SHA-256 прошли. В архиве 4 317 файлов, включая 4 306 статей: Go — 3, Rust — 3, PostgreSQL — 1 148, Bash — 1, Linux man-pages — 3 151. Независимая проверка ZIP сверила полный список с `git ls-tree`, хэши Git-объектов, SHA-256 всех статей, манифест и режимы файлов. В архиве есть каталог, источники, уведомление и пять лицензионных файлов, включая исходный архив Linux man-pages. Размер — 17 642 862 байта. SHA-256 проверенного VSIX — `b7332d6a4f19594126945edd2c66bbf4a66250cb38a41848f3de834feff54165`.

CLI установил VSIX в чистый профиль с заблокированной сетью. `--list-extensions --show-versions` вернул `myself.offline-documentation@0.1.0`, все 4 314 установленных файлов документации побайтово совпали с VSIX. Trace показал попытку запроса метаданных `POST https://open-vsx.org/vscode/gallery/extensionquery` от штатного установщика. Сетевой доступ процесса был заблокирован профилем sandbox-exec, установка завершилась успешно.

## Повторение установки на macOS

```sh
app_cli="/Applications/Nerded Code.app/Contents/Resources/app/bin/code"
profile="$(mktemp -d)"
cli=(sandbox-exec -p '(version 1) (allow default) (deny network*)' "$app_cli" --user-data-dir "$profile/user" --extensions-dir "$profile/extensions")
"${cli[@]}" --list-extensions
"${cli[@]}" --log trace --install-extension "$PWD/.build/vsix/myself.offline-documentation-0.1.0.vsix"
"${cli[@]}" --list-extensions --show-versions
test -f "$profile/extensions/myself.offline-documentation-0.1.0/documentation/catalog.json"
```

Для приёмки следующего этапа открыть пять наборов из библиотеки, отключить пакет, удалить его из последнего использующего профиля и перезапустить IDE. Затем проверить очистку с диска, сохранность личного импорта, повторную установку и отсутствие копии официального снимка в базовом подписанном приложении.
