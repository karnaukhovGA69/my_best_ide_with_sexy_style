# Видимые действия задач проекта

Task ID `project-task-actions`. База `445e1988539eb1c2f5786593776972f51d45a212`, ветка `codex/project-task-actions`. Область изменений — `src/vs/workbench/contrib/myselfProjectActions/**` и этот отчёт. Реализация готова к интеграции и независимой проверке.

Раньше пользователю требовалось искать команды Tasks в меню терминала. Новые действия дают компактный доступ через заголовок дерева Files и отдельную группу меню Terminal. «Run Task…» означает выбор задачи. Build и Tests используют штатные default build/test задачи или стандартный выбор/настройку при их отсутствии. Соответствия фиксированы, входные аргументы команд отбрасываются.

| Команда | Стандартный путь |
| --- | --- |
| `myself.project.runTask` | `workbench.action.tasks.runTask` |
| `myself.project.build` | `workbench.action.tasks.build` |
| `myself.project.test` | `workbench.action.tasks.test` |

В `browser/myselfProjectActions.contribution.ts` зарегистрированы три Action2 и статические menu contributions. Используются существующие `ViewTitle` с `view == workbench.explorer.fileView`, `MenubarTerminalMenu` и контексты Workspace Trust, TaskExecutionSupported и TaskCommandsRegistered. Открытие меню читает только описания действий. Прямой обработчик дожидается `workspaceTrustInitialized`, проверяет `isWorkspaceTrusted()` и только после этого получает `ICommandService`. В Restricted Mode отображается локальное информационное сообщение. Для корректного lifetime ServicesAccessor используется согласованный с архитектором существующий `IInstantiationService.invokeFunction`.

Трасса стандартного Tasks проверена в `tasks/browser/abstractTaskService.ts`. Обработчики runTask/build/test проверяют `_trust()` перед своими `_run*`. RunTask владеет picker, группы Build/Test владеют default/configure flow, `run()` проверяет `_trust()` перед выполнением. Выбор корня и задачи принадлежит Tasks. Возврат `executeCommand` для Build/Test означает отправку команды, а завершение самой задачи наблюдается штатным Tasks UI.

## Подключение интегратором

Добавить в `src/vs/workbench/workbench.desktop.main.ts` импорт `./contrib/myselfProjectActions/browser/myselfProjectActions.contribution.js`. Добавить `vs/workbench/contrib/myselfProjectActions` в `build/lib/i18n.resources.json`. При интеграции проверить предупреждение `code-import-patterns`, полученное при использовании общего ESLint config из другого checkout. Интегратор подтвердил, что существующий wildcard может покрывать новый contrib. Эти общие файлы оставлены интегратору по распределению владения. Подписи используют `nls.localize/localize2`, переводы поступают через общий механизм локализации.

## Выполненные проверки

13 unit-тестов прошли через Mocha и узкий esbuild-бандл настоящих исходников с реальными CommandsRegistry, MenuRegistry и InstantiationService. Проверены все три прямых untrusted-вызова без активации сервиса команд, ожидание trust initialization с отзывом trust, точный ID без forwarded args, завершение отменённой команды без fallback, ошибка команды, ошибка инициализации и disabled/static menu contributions. Ленивая активация сервиса команд измеряется SyncDescriptor. Первая версия, использовавшая accessor после await, воспроизвела ошибку настоящего InstantiationService. Текущая версия этот тест проходит.

Целевая синтаксическая и семантическая проверка TypeScript двух новых файлов с options из `src/tsconfig.json` дала 0 диагностик. Полный client typecheck не запускался. ESLint дал 0 ошибок и три предупреждения — `local/code-import-patterns` для двух новых файлов (Missing definition) и `local/code-translation-remind` для contribution. Ошибок разрешённых/запрещённых import нет. Общие подключения перечислены выше. `git diff --check` прошёл. Узкие проверки используют уже установленные инструменты другого checkout для чтения, бандл и промежуточные файлы создаются только в своём `.build/project-task-actions`.

Лёгкий повтор unit-тестов из корня своего checkout, с переменной `TOOLS_ROOT`, указывающей на checkout с установленными закреплёнными зависимостями.

```sh
node --input-type=commonjs <<'JS'
const path = require('node:path');
const { createRequire } = require('node:module');
const tools = createRequire(path.join(process.env.TOOLS_ROOT, 'package.json'));
const output = '.build/project-task-actions/myselfProjectActions.test.cjs';
tools('esbuild').buildSync({
  entryPoints: ['src/vs/workbench/contrib/myselfProjectActions/test/browser/myselfProjectActions.test.ts'],
  bundle: true, platform: 'node', format: 'cjs', outfile: output,
  nodePaths: [path.join(process.env.TOOLS_ROOT, 'node_modules')],
});
const Mocha = tools('mocha');
const mocha = new Mocha({ ui: 'tdd' });
mocha.addFile(output);
mocha.run(failures => { process.exitCode = failures ? 1 : 0; });
JS
```

## Проверки общего пакета

Окна и полный пакет IDE для этой правки не запускались. Содержимое реального Tasks picker, default-задачи, пустой проект, одинаковые labels в multi-root и отзыв доверия после dispatch требуют интеграционной проверки штатного Tasks. Unit-тест отмены моделирует возвращение из штатной команды, а реальное поведение picker проверяется в общем пакете.

1. Открыть доверенный тестовый проект с заранее созданными build/test задачами. Проверить кнопки Files и группу Terminal. Убедиться, что вызывается ожидаемая стандартная задача.
2. В проекте без задач нажать Run Task…, затем отменить выбор/настройку. Проверить отсутствие запуска и записей от самого действия. Явная настройка задачи продолжает принадлежать стандартному Tasks UI.
3. В multi-root проекте с одинаковыми именами задач проверить отображение корней штатным picker и выбор задачи второго корня. Отменить повторный выбор.
4. В Restricted Mode проверить disabled-действия. Прямо вызвать каждый новый command ID и подтвердить сообщение, отсутствие provider/resolve/terminal activation. Отдельно проверить отзыв trust во время стандартного picker.
5. Проверить расположение кнопок на узкой панели, keyboard focus и переведённые подписи после общего подключения локализации.
