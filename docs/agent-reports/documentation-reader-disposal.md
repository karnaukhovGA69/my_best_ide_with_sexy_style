# documentation-reader-disposal

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. База: fefa1a95ee3. Область: extensions/myself-documents/src/library.ts — lifecycle загрузки каталога, open/search/message и закрытие reader; test/library-host.test.cts; этот отчёт. Закрытие панели сейчас не отменяет pending read, который может открыть reader снова. Dispose при незавершённой загрузке каталога также не запрещает следующий open. Добавить async lifecycle guards и воспроизводящие tests; не менять дизайн, imports storage или scope UI-агента. Полную app сборку не запускать.
