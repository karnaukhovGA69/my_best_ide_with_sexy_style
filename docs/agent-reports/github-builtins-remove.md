# github-builtins-remove

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: b73001809cd + github-link-presentations-remove. Ветка: agent/github-builtins-remove.

Исключить встроенные github/github-authentication extensions из публичной поставки и stale build output согласно решению владельца. Область: build/lib/distributionExtensions.ts, его test/distributionExtensions.test.ts, docs/myself-ide.md. Сначала проверить extensionDependencies retained built-ins. Сохранить git/git-base, clone по URL/SSH, общий authentication API и остальные providers. Сами source folders/lockfiles не удалять в этой задаче. SettingsTransfer, runtime GitHub service consumers и чужие MCP/voice задачи не менять.

GitHub и GitHub Authentication исключены из allowlist; фильтр упаковки исключает и прежний output. Manifest scan retained built-ins подтвердил отсутствие missing extensionDependencies; git зависит от git-base, не от GitHub. Обновлён контракт stale output и описание source состояния. Проверки: 3 Node distribution tests passed, ESLint двух файлов и git diff --check прошли. Проверку фактической упаковки/обычного Git выполнить на следующем native цикле. Источники GitHub extensions и часть core GitHub runtime остаются; это не полное удаление исходников.
