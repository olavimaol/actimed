# Agrumea Farm

Оригинал: https://www.agrumeafarm.it/en. Адрес копии: `/en/` и `/`.

В `public/` находятся английская и итальянская версии, каталог десяти товаров,
производство, впечатления, компания, контакты и политика конфиденциальности.
Собственные стили находятся в `public/theme/aqua.css`; палитра бирюзово-голубая,
с мягкими градиентами. Декоративные полосы удалены.

На главной этикетка одной апельсиновой банки заменена пользовательским фото.
Оригинал и развёртка находятся в `public/assets/custom/`.
`public/theme/site-switcher.js` и `.css` отвечают за ссылки на остальные
сайты в полноэкранном меню Agrumea.

`previews/` содержит сохранённые версии оформления, `reports/` — отчёты переноса,
`archives/` — исторический ZIP. Архив не является текущим исходником.

## Повторный перенос и настройки

```sh
python3 websites/agrumea/scripts/mirror_public.py
python3 websites/agrumea/scripts/finalize.py
python3 websites/agrumea/scripts/apply_aqua_theme.py
python3 websites/agrumea/scripts/apply_photo_label.py
```

Первые две команды используют интернет. Данные CMS зафиксированы в страницах
и `_payload.json`. Изображения, этикетки, шрифты и анимации находятся локально.
Shop ведёт в исходный магазин Riblo; покупки оформляются у магазина.

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
