# Ricardo Chance

Оригинал: https://www.ricardochance.com. Адрес копии: `/ricardo/`.

`public/` содержит главную, About и Work на английском и испанском,
3D-фигуру из частиц, звёздный фон и эффекты прокрутки.
Все ресурсы этого сайта, включая видео, текстуры и шрифты, находятся локально.
В конце прокрутки частицы собираются в NEXGROUP. Контуры букв строятся отдельно;
55% точек распределены по контурам, при сборке уменьшаются глубина и свечение.
Сборка завершается у низа страницы, включая крайние буквы.

Форма демонстрационная. Внешние проекты и социальные ссылки сохранены.
Скриншоты главной и вариантов NEXGROUP находятся в `previews/`.

## Повторный перенос

```sh
python3 websites/ricardo/scripts/download.py
python3 websites/ricardo/scripts/install.py
python3 websites/ricardo/scripts/ricardo_footer.py websites/ricardo/public
```

`ricardo_runtime.py` содержит изменения навигации и формы;
`ricardo_footer.py` — геометрию и чёткость NEXGROUP.

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
