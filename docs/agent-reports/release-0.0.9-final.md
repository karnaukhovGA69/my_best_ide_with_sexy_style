# release-0.0.9-final

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. Ветка: integration/release-0.0.9-final. База: main 8a9f66bc9af после семи срезов integration-post-0.0.9.

Область: один общий macOS ARM64 package/native/sign/privacy/ZIP/release цикл всех накопленных изменений main до этой базы. Полный client typecheck седьмого среза прошёл; исходные inputs после него не менялись. Новая сборка обоснована четырьмя срезами, отсутствующими в локальном build 7e52ba80469. Не расширять snapshot готовыми задачами, появившимися позднее. Не запускать параллельные package/typecheck. GitHub authorization/связанные task branches исключены.

Старый binary 41c46a51f99 сохраняется в отдельном snapshot-каталоге; проверенная локальная сборка другого агента 7e52ba80469 не меняется. Native smoke, документы/Save As/settings, PDF и подпись/ASAR/privacy/ZIP — обязательные проверки перед публикацией. Результаты старых проверок переиспользуются только для неизменившихся inputs и явно отделяются от нового binary QA. Последний опубликованный release пока 0.0.8.
