# AMANATION

Оригинал: https://www.amanation-official.com. Адрес копии: `/amanation/`.

`public/` содержит вращающийся куб, анимации, каталог авторов, страницы работ,
новости, компанию и контакты. Используются готовые WebP-версии изображений
самого оригинала; крупные дубли заменены его адаптивными версиями
с сохранением пропорций. Форма демонстрационная.

## Повторный перенос

```sh
python3 websites/amanation/scripts/download.py
python3 websites/amanation/scripts/install.py
python3 tools/optimize_assets.py amanation
```

Скрипт `install.py` обрабатывает только AMANATION; общая логика импорта
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
