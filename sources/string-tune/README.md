# StringTune

Оригинал: https://string-tune.fiddle.digital. Адрес копии: `/string-tune/`.

`public/` содержит меч WebGL, эффекты прокрутки, Dev Guides, Skill Hub
и 23 интерактивных примера со скачиванием.
Модели, текстуры и шрифты находятся здесь. Общие декодеры Draco вынесены в
`../../shared/public/string-tune/libs/draco/`; адреса в браузере сохранены.
Видеопревью воспроизводятся с публичных адресов оригинала для лимита хостинга.
Формы работают в демонстрационном режиме.

## Повторный перенос

```sh
python3 websites/string-tune/scripts/download.py
python3 websites/string-tune/scripts/install.py
python3 tools/optimize_assets.py string-tune
```

Скрипт `install.py` обрабатывает только StringTune; общая логика импорта
находится в `tools/import_frontend.py`.

## Сборка и просмотр

Команды выполняются из корня `website-collection`:

```sh
python3 tools/build.py
python3 tools/verify_sites.py
python3 tools/preview.py
```

Редактируйте `public/` в этой папке; `dist/` создаётся автоматически.
Общее меню и общие библиотеки находятся в `../../shared/`.
После повторного импорта запустите `python3 shared/scripts/install_menu.py`.
