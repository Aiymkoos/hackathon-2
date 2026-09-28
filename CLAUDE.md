# hackathon-2 — «Маэстро»

Admit Hackathon, кейс «Камера вместо джойстика». Веб-приложение: пользователь дирижирует виртуальным оркестром через веб-камеру. Сдача: 30 сентября 2026, 15:00 (Астана).

## Стек
Чистый HTML/CSS/JS (ES-модули, без сборки). MediaPipe Pose Landmarker (`@mediapipe/tasks-vision@1.0.1` с jsDelivr), Web Audio для синтеза оркестра, Canvas 2D для графики.

## Как запускать
- `python -m http.server 5173` в корне репозитория, открыть http://localhost:5173
- Без камеры: http://localhost:5173/?debug (мышь = правая рука, 1/2/3, B, U)
- Тесты: `node tests/conductor.test.mjs`

## Устройство
- `js/conductor.js` — собственная логика распознавания (доли, темп, указание, фермата). Всё в «ширинах плеч».
- `js/music.js` — синтез + `Performance` (следует за темпом дирижёра).
- `js/piece.js` — партитура и отметки p/mf/f, вступления.
- `js/scenes/*` — menu, rehearsal, concert, results. Сцена может задать `toastBottom`.
- Подсказки режима «ошибка» — в `concert.js` (`ERRORS`) и `rehearsal.js`.

## Правила работы
- После каждого законченного рабочего шага: `git commit` с понятным сообщением и `git push`.
- Для больших задач сначала план, потом код.
- Секреты только в `.env` (он в .gitignore), в код не вписывать.
- Ветка `mage-prototype` — отложенная первая идея, в main не сливать.
