"""Use the supplied photo on one rotating jar label on the homepage only."""
from pathlib import Path
import base64
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'public'
CUSTOM = DIST / 'assets/custom'
LABEL_URL = '/assets/custom/orange-photo-label.svg'
PHOTO = CUSTOM / 'orange-label-reference.png'
SKU = 'marmellata_arancia'

# Keep the original photograph intact and centered on an unrolled 1600×607
# label. The blue sides are the back of the cylinder during a full turn.
photo_data = base64.b64encode(PHOTO.read_bytes()).decode('ascii')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="607" viewBox="0 0 1600 607">
<rect width="1600" height="607" fill="#079ec2"/>
<image x="496.5" y="0" width="607" height="607" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,{photo_data}"/>
</svg>'''
(CUSTOM / 'orange-photo-label.svg').write_text(svg)

for route in ('', 'en'):
    folder = DIST / route
    payload_file = folder / '_payload.json'
    payload = json.loads(payload_file.read_text())
    matches = [item for item in payload if isinstance(item, dict)
               and 'uid' in item and 'heroLabelImage' in item
               and payload[item['uid']] == SKU]
    assert len(matches) == 1, 'Expected exactly one orange product per homepage.'
    product = matches[0]
    image = payload[product['heroLabelImage']]
    if payload[image['url']] != LABEL_URL:
        new_image = dict(image)
        new_image['url'] = len(payload)
        payload.append(LABEL_URL)
        product['heroLabelImage'] = len(payload)
        payload.append(new_image)
    payload_file.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))

    page = folder / 'index.html'
    html = page.read_text()
    expression = r'(<a\b[^>]*href="/(?:en/)?dispensa/marmellata_arancia"[^>]*\bdata-label=")[^"]+("[^>]*>)'
    html, count = re.subn(expression, lambda m: m[1] + LABEL_URL + m[2], html)
    assert count == 1, 'Expected exactly one orange jar in the server-rendered homepage.'
    page.write_text(html)

print('One orange jar label replaced on the Italian and English homepages.')
