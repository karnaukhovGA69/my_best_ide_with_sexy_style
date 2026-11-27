# Обзор локальных Git изменений из Files

Task ID `explorer-git-diff`. База `7b392a2331228de328912aa190248cc1323a2d7d`, ветка `codex/explorer-git-diff`. Изменены `extensions/git/package.json`, `extensions/git/package.nls.json` и этот отчёт.

Раньше команды многофайлового обзора находились в Git/SCM. Теперь заголовок дерева Files получает одно подменю Local Git Changes со значком `diff-multiple`. Выбранная группа открывается штатным MultiDiff в области редактора, рядом с деревом Files. Размещение использует существующий `view/title`, группа `navigation@4`.

| Пункт | Команда | Группа Git |
| --- | --- | --- |
| Open Working Tree Changes | `git.viewChanges` | `workingTreeGroup` |
| Open Staged Changes | `git.viewStagedChanges` | `indexGroup` |
| Open Untracked Changes | `git.viewUntrackedChanges` | `untrackedGroup` |

Untracked виден при `git.untrackedChanges == separate`. При `mixed` неотслеживаемые файлы входят в Working Tree, при `hidden` Git их скрывает. Merge group остаётся отдельной группой SCM. Название существующей команды `git.viewChanges` уточнено с Open Changes до Open Working Tree Changes во всех местах, где используется `command.viewChanges`.

Подменю видно для `view == workbench.explorer.fileView`, включённого и найденного Git, `git.state == initialized`, `gitOpenRepositoryCount > 0` и доверенной рабочей области. Используются существующие контексты и механизм локализации манифеста. Дополнительных imports/registrations в core entrypoints для интеграции нет.

## Проверенная трасса

`ViewPane.getActionsContext()` возвращает undefined, ExplorerView не переопределяет контекст заголовка. Поэтому `CommandCenter.createCommand()` для этих repository-команд вызывает `Model.pickRepository()`. При нескольких открытых и видимых репозиториях используется штатный Quick Pick, при одном — этот репозиторий. Отмена возвращает undefined и завершает обработчик.

`viewChanges`/`viewStagedChanges`/`viewUnstagedChanges` передают выбранный Repository и его соответствующую группу в `_viewResourceGroupChanges`. Пустая группа даёт штатное информационное сообщение. Непустая вызывает `_workbench.openScmMultiDiffEditor` с `repositoryUri` и `resourceGroupId`. `OpenScmGroupAction` открывает существующий SCM MultiDiff через editor service. Расширение Git объявляет `untrustedWorkspaces.supported == false`. Новое меню дополнительно использует trust context.

## Проверки

До правки на базе отсутствовали и Files menu binding, и новое подменю. После правки JSON успешно разобран, ключ локализации найден, три command ID зарегистрированы в существующем манифесте. Через настоящий `ContextKeyExpr.deserialize` проверены видимость родителя, скрытие при другом view, выключенном/отсутствующем Git, uninitialized state, нуле/отсутствии repository count и Restricted Mode. Проверены все три режима untrackedChanges.

В одноразовом синтетическом стенде транспилированы настоящие исходники `CommandCenter`, `Model` и Git decorators. API vscode и остальные внешние зависимости изолированы подменами, конструктор Model с наблюдением файлов не запускается. Зарегистрированные три command handler последовательно выбрали второй репозиторий из стандартного picker и передали в `_workbench.openScmMultiDiffEditor` его URI и правильную группу. Проверены отмена picker и три пустые группы — MultiDiff не открывался, появились штатные сообщения. Открытие/регистрация меню не вызвало команд. Файлы реального репозитория и его Git index не менялись этими сценариями.

`git diff --check` прошёл. Изменены только метаданные и локализация. Полный typecheck, сборка и окно IDE не запускались. Native-проверка расположения кнопки, сохранения Files рядом с MultiDiff и работы расширения Git в установленном профиле предстоит в общем пакете.

## Короткая проверка метаданных

Из корня checkout можно повторить базовые проверки без зависимостей.

```sh
node --input-type=commonjs <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync('extensions/git/package.json'));
const strings = JSON.parse(fs.readFileSync('extensions/git/package.nls.json'));
const { menus, submenus, commands } = manifest.contributes;
const [entry] = menus['view/title'].filter(item => item.submenu === 'git.explorerChanges');
assert.ok(entry.when.includes('gitOpenRepositoryCount > 0'));
assert.ok(entry.when.includes('isWorkspaceTrusted'));
const submenu = submenus.find(item => item.id === entry.submenu);
assert.equal(strings[submenu.label.slice(1, -1)], 'Local Git Changes');
assert.deepEqual(menus[entry.submenu].map(item => item.command), ['git.viewChanges', 'git.viewStagedChanges', 'git.viewUntrackedChanges']);
assert.ok(menus[entry.submenu].every(item => commands.some(command => command.command === item.command)));
assert.equal(menus[entry.submenu][2].when, 'config.git.untrackedChanges == separate');
console.log('Explorer Git menu metadata passed');
JS
```

## Приёмка общего пакета

1. В тестовой доверенной папке подготовить несколько tracked файлов, staged изменения и новые untracked файлы. Через заголовок Files открыть каждую доступную группу и сверить список файлов. Убедиться, что дерево Files остаётся рядом с обзором.
2. Для `mixed`, `separate` и `hidden` проверить состав подменю и соответствующие группы MultiDiff. Пустая группа должна показывать штатное сообщение.
3. В multi-root проекте с двумя репозиториями выбрать второй в штатном picker. Проверить URI и набор его изменений. Повторить и отменить выбор. Файлы и index должны сохранить состояние.
4. Проверить скрытие при `git.enabled == false`, отсутствии открытого репозитория, Restricted Mode и при другом view. Само открытие подменю не должно выполнять Git-команды.
5. Проверить доступность меню с клавиатуры, узкую Files panel и заголовок/overflow в общем оформлении.
