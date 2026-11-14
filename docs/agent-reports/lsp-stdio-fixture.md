# Изолированный тест LSP через stdio

Часть [#4](https://github.com/karnaukhovGA69/my_best_ide_with_sexy_style/issues/4). Ветка `agent/lsp-stdio-fixture` от `6e5382f8f63` ([PR #23](https://github.com/karnaukhovGA69/my_best_ide_with_sexy_style/pull/23)). До этого этапа тесты расширения покрывали импорт, список, очистку и удаление пакетов. Теперь отдельный тест проверяет обмен LSP по реальным stdin/stdout. Интерфейс IDE по-прежнему предоставляет импорт, обновление списка и удаление пакетов.

- `test/stdio.test.cts` берёт реализацию протокола из уже установленной цепочки зависимостей CSS-расширения. Проверяет SHA-256 синтетического сервера до запуска и пишет эти же байты в новый приватный временный каталог. Запускает текущий Node/Electron в режиме Node по абсолютному пути с фиксированным аргументом, без shell и с ограниченным окружением. Есть таймаут, принудительная очистка дочернего процесса при сбое теста и удаление временного каталога.
- `test/fixtures/stdio-server.cts` независимо обрабатывает тестовую последовательность LSP. Тест проверяет `initialize` и возможности, `initialized`, `didOpen`, push-диагностику с версией и URI документа, completion на позиции и штатные `shutdown` и `exit`. Не-ASCII текст проверяет байтовую длину кадров. Подтверждение завершения — закрытие дочернего процесса с кодом 0 без сигнала.
- `test/vsix.test.cts` проверяет точный состав пакета и команды, объявленные манифестом и зарегистрированные расширением. Проверяет, что бандл не содержит маркеров фикстуры, `child_process` и доступа к `process.argv` или `process.env`. Бинарник и вспомогательный файл из ZIP после импорта имеют права `0600`.

## Воспроизведение

В macOS ARM64 прошли 33 теста без пропусков под запретом сети через Node 24.22.1 из Electron. Целевой TypeScript, ESLint, сборка VSIX и `git diff --check` прошли. SHA-256 файла `extension/dist/extension.js` совпал со сборкой из #23. Временную копию VSIX с добавленным импортом `node:child_process` smoke-тест отклонил до активации расширения. Окна IDE и полный пакет приложения не запускались. Вручную воспроизвести проверку можно командами ниже из корня рабочего дерева с установленными зависимостями.

```sh
./node_modules/.bin/tsc -p extensions/myself-language-servers
node extensions/myself-language-servers/package-vsix.mts .build/lsp-stdio-test
LANGUAGE_SERVERS_TEST_VSIX="$PWD/.build/lsp-stdio-test/myself.myself-language-servers-0.1.1.vsix" \
  ELECTRON_RUN_AS_NODE=1 /usr/bin/sandbox-exec -p '(version 1) (allow default) (deny network*)' \
  '/Applications/Nerded Code.app/Contents/MacOS/Nerded Code' --test extensions/myself-language-servers/test/*.test.cts
```

Результат ограничен транспортом, push-диагностикой и completion синтетического процесса. Отображение в редакторе, pull-диагностика и completion resolve остаются отдельными проверками клиентской интеграции. Пользовательский Start из ZIP и core uninstall вне этого этапа.

Отдельный критерий для будущего supervisor — после аварийного завершения Extension Host второй экземпляр на macOS ARM64 продолжает получать «занято» при попытке удалить пакет, пока синтетический сервер жив, затем подтверждает выход процесса и только после этого может удалить пакет. Для runnable-пакетов требуется хранилище, изолированное от старого Remove, и отдельное подтверждение trust-контракта.
