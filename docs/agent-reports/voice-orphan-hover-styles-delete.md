# voice-orphan-hover-styles-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/voice-orphan-hover-styles-delete`. База: `411cccde06e843fac42e170ccf749f7784c7f7e3` (toolbar/indicator/glow removal уже integrated).

A06: физически удалить orphan microphone hover helper/test и два CSS голосовой подсветки. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/micButtonHovers.ts`, `src/vs/workbench/contrib/chat/test/browser/micButtonHovers.test.ts`, `src/vs/workbench/contrib/chat/browser/speechToText/media/dictationMicGlow.css`, `src/vs/workbench/contrib/chat/browser/voiceClient/media/voiceGlow.css` и этот отчёт. Caller/reference scan подтверждает отсутствие production imports; helper используется только своим obsolete test. Shared entrypoints/build/common UI/auth/Git/SSH/history и чужие задачи исключены. Работа готовится отдельно от уже frozen release batch.
