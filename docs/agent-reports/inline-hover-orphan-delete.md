# inline-hover-orphan-delete

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/inline-hover-orphan-delete. База: main eab8fa4a00d.

Область: удалить только orphan src/vs/editor/contrib/inlineCompletions/browser/hintsWidget/hoverParticipant.ts и убрать его искусственный import из src/vs/workbench/contrib/inlineCompletions/test/browser/inlineCompletionsDistribution.test.ts. Реестр обычных hover, IntelliSense и API не меняются. Поиск по src/build/test/extensions обнаружил единственного потребителя — тест отсутствующей регистрации. Оставшиеся inline controller/widget имеют других потребителей и в эту задачу не входят. Общие entrypoints/build и чужие области не менять.
