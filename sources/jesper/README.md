# Jesper Landberg

Оригинал: https://jesperlandberg.com. Адрес копии: `/jesper/`.

`public/` содержит объёмную ленту Featured, индекс 23 проектов, восемь подробных
страниц работ, профиль с 3D-моделями и экран Newsletter.
Данные проектов находятся в `public/data/site.json`.
Шрифты, glyphs, текстуры, модели и декодеры сохранены локально.
Видео и запасные изображения используют публичные CDN оригинала.
Доступ к CMS и отправка подписки оригинальному владельцу отключены.

Сохранённый скриншот находится в `previews/`, отчёт — в `reports/`.

## Повторный перенос

```sh
python3 websites/jesper/scripts/download.py
python3 websites/jesper/scripts/install.py
```

Небольшие ссылки возврата оформлены в `public/replica.css`.

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
