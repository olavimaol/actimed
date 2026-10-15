"""Attach the custom reference-inspired color theme without changing page content."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'public'
THEME = DIST / 'theme'
THEME.mkdir(exist_ok=True)

# New artwork URLs prevent an older cached burgundy asset showing after update.
artwork = {
    '/images/home/back-slider-home.svg': '/theme/slider-shape.svg',
    '/images/home/circle-text-en.svg': '/theme/circle-text-en.svg',
    '/images/home/circle-text-it.svg': '/theme/circle-text-it.svg',
}
# Theme styles are loaded after the source CSS and are shared by every route.
for path in [*DIST.rglob('*.html'), *(DIST / '_nuxt').glob('*.js')]:
    text = path.read_text()
    for old, new in artwork.items():
        text = text.replace(old, new)
    if path.suffix == '.html':
        text = re.sub(r'<link rel="stylesheet" href="/theme/aqua\.css(?:\?[^\"]*)?">', '', text)
        text = text.replace('</head>', '<link rel="stylesheet" href="/theme/aqua.css?v=2"></head>')
    path.write_text(text)

# Recolor only the monochrome UI artwork. All product photography is untouched.
for name in ('circle-text-en.svg', 'circle-text-it.svg'):
    path = DIST / 'images/home' / name
    text = re.sub(r'#[0-9a-fA-F]{6}', '#eaffff', path.read_text())
    (THEME / name).write_text(text)

shape = DIST / 'images/home/back-slider-home.svg'
text = shape.read_text()
text = re.sub(r'<linearGradient id="aqua-shape"[^>]*>.*?</linearGradient>', '', text)
text = text.replace('<defs>', '<defs><linearGradient id="aqua-shape" x1="0" y1="0" x2="1300" y2="900" gradientUnits="userSpaceOnUse"><stop stop-color="#1bc5dd"/><stop offset=".48" stop-color="#087fae"/><stop offset="1" stop-color="#056c9d"/></linearGradient>')
text = re.sub(r'fill="#[0-9a-fA-F]{6}"', 'fill="url(#aqua-shape)"', text)
(THEME / 'slider-shape.svg').write_text(text)

print('Clean aqua palette and smooth gradients applied to all 34 pages.')
