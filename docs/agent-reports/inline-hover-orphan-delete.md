# inline-hover-orphan-delete

Статус: ГОТОВО к следующему интеграционному срезу. Владелец: чат упрощения Myself IDE. Ветка: agent/inline-hover-orphan-delete. База: main eab8fa4a00d.

Область: удалить только orphan src/vs/editor/contrib/inlineCompletions/browser/hintsWidget/hoverParticipant.ts и убрать его искусственный import из src/vs/workbench/contrib/inlineCompletions/test/browser/inlineCompletionsDistribution.test.ts. Реестр обычных hover, IntelliSense и API не меняются. Поиск по src/build/test/extensions обнаружил единственного потребителя — тест отсутствующей регистрации. Оставшиеся inline controller/widget имеют других потребителей и в эту задачу не входят. Общие entrypoints/build и чужие области не менять.

Результат: удалён orphan hoverParticipant.ts (185 строк), включая генеративную панель hover, UI subscriptions, screen-reader rendering и inlineCompletionHover.shown событие. Из distribution test удалён import физически отсутствующего класса и только его obsolete assertion; проверки controller/accessibility, actions/menu/keybindings и обычного IntelliSense сохранены. Никакие production hover registries не изменены.

Проверки: поиск InlineCompletionsHover и hintsWidget/hoverParticipant в src/build/test/extensions после удаления — совпадений нет. 10 browser tests passed (distribution + ordinary Suggest), 0 page errors. Узкая TypeScript-проверка изменённого теста: 0 diagnostics; ESLint и git diff --check пройдены. Проверка не заявляет удаление всего inline controller/widget: у них остаются общие потребители. Общий integration/native smoke выполняется пакетно владельцем сборки; новая задача не меняет входы уже начатой сборки. Wiring не требуется.
