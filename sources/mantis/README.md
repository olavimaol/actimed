# Mantis

Оригинал: https://www.mantis.works. Адрес копии: `/mantis/`.

`public/` содержит анимированную каркасную руку, эффекты прокрутки,
услуги и четыре подробных проекта. Видео исключены по запросу пользователя;
вместо них используются изображения оригинала. Крупные дубли изображений
заменены готовыми WebP-вариантами оригинала.

## Повторный перенос

```sh
python3 websites/mantis/scripts/download.py
python3 websites/mantis/scripts/install.py
python3 tools/optimize_assets.py mantis
```

Скрипт `install.py` обрабатывает только Mantis; общая логика импорта
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
