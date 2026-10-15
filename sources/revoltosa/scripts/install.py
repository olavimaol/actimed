#!/usr/bin/env python3
"""Mount the public La Revoltosa frontend with local animation dependencies."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import html
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
STAGE = Path('/private/tmp/revoltosa-original')
TARGET = ROOT / 'public'
ORIGIN = 'https://larevoltosa.es'
MOUNT = '/revoltosa'
THEME = '/wp-content/themes/larevoltosa'
TEXT = {'.html', '.css', '.js', '.json', '.gltf', '.webmanifest', '.svg'}

report = json.loads((STAGE / 'report.json').read_text())
reported = {row['path'] for row in report['routes'] + report['resources'] if row.get('status') == 200}
pages = [STAGE / name for name in reported if name.endswith('.html')]
assert (STAGE / 'index.html').is_file(), 'Download the public source first'
textures = set()
for page in pages:
    for value in re.findall(r'data-(?:tag|illustration)-url=["\']([^"\']+)', page.read_text()):
        textures.add(unquote(urlsplit(html.unescape(value)).path))

font_sources = {}
font_files = set()
for css in (STAGE / THEME.lstrip('/') / 'fonts').rglob('*.css'):
    candidates = []
    for value in re.findall(r'url\(\s*["\']?([^\)"\']+)["\']?\s*\)', css.read_text()):
        file = (css.parent / unquote(urlsplit(value).path)).resolve()
        if file.is_file() and str(file.relative_to(STAGE)) in reported:
            candidates.append((file, value))
    if candidates:
        rank = {'.woff2': 0, '.woff': 1, '.otf': 2, '.ttf': 3}
        file, value = min(candidates, key=lambda pair: rank.get(pair[0].suffix, 9))
        font_sources[str(css.relative_to(STAGE))] = (file, value)
        font_files.add(str(file.relative_to(STAGE)))

# These vendor files are byte-for-byte identical to the already hosted decoder.
for filename in ('draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'):
    original = STAGE / THEME.lstrip('/') / 'src/bemit/09-components/c-storytelling-v2/draco' / filename
    shared = ROOT.parents[1] / 'shared/public/string-tune/libs/draco' / filename
    assert hashlib.sha256(original.read_bytes()).digest() == hashlib.sha256(shared.read_bytes()).digest()


def local(path):
    name = '/' + str(path.relative_to(STAGE))
    if path.suffix == '.html':
        return True
    if name.startswith(THEME + '/'):
        if '/draco/' in name:
            return False
        if path.suffix in {'.otf', '.woff', '.woff2', '.ttf'}:
            return str(path.relative_to(STAGE)) in font_files
        return True
    if name in textures:
        return True
    if path.suffix in {'.css', '.svg', '.ico'}:
        return True
    return False


selected = [STAGE / name for name in reported if local(STAGE / name)]
if TARGET.exists():
    shutil.rmtree(TARGET)
for path in selected:
    destination = TARGET / path.relative_to(STAGE)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, destination)

local_paths = {'/' + str(path.relative_to(STAGE)) for path in selected}


def rebase_href(match):
    quote, value = match[1], match[2]
    parsed = urlsplit(html.unescape(value))
    if value.startswith(('#', 'mailto:', 'tel:', 'javascript:')) or parsed.hostname not in (None, 'larevoltosa.es', 'www.larevoltosa.es'):
        return match[0]
    if parsed.path.startswith(MOUNT + '/'):
        return match[0]
    if parsed.path.startswith(('/wp-content/', '/wp-includes/', '/wp-json/', '/wp-admin/')):
        return match[0]
    if Path(parsed.path).suffix and not parsed.path.endswith('.html'):
        return match[0]
    if parsed.path and not parsed.path.startswith('/'):
        return match[0]
    result = MOUNT + (parsed.path or '/')
    if parsed.query:
        result += '?' + parsed.query
    if parsed.fragment:
        result += '#' + parsed.fragment
    return 'href=' + quote + result + quote


def scripts(match):
    tag = match[0]
    # The visual runtime is self-contained. Cookie choices and form submission
    # are handled locally, with no original analytics or contact backend.
    if re.search(r'\bid=["\']main-js(?:-extra)?["\']', tag):
        return tag
    if 'application/ld+json' in tag:
        return tag
    return ''


def compact_html(text):
    protected = []
    def protect(match):
        protected.append(match[0])
        return '@@REVOLTOSA_BLOCK_' + str(len(protected) - 1) + '@@'
    text = re.sub(r'<(?:pre|textarea|script|style)\b.*?</(?:pre|textarea|script|style)>', protect, text, flags=re.S | re.I)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'>[ \t\r\n]+<', '> <', text)
    def compact_tag(match):
        tag = match[0]
        result = []
        quote = None
        for character in tag:
            if quote:
                result.append(character)
                if character == quote:
                    quote = None
            elif character in ('"', "'"):
                quote = character
                result.append(character)
            elif character.isspace():
                if result and result[-1] != ' ':
                    result.append(' ')
            else:
                result.append(character)
        return ''.join(result)
    text = re.sub(r'<[A-Za-z/](?:"[^"]*"|\'[^\']*\'|[^\'">])*>', compact_tag, text)
    for index, block in enumerate(protected):
        text = text.replace('@@REVOLTOSA_BLOCK_' + str(index) + '@@', block)
    return text


for path in TARGET.rglob('*'):
    if not path.is_file() or path.suffix not in TEXT:
        continue
    text = path.read_text()
    for origin in (ORIGIN, 'https://www.larevoltosa.es'):
        text = text.replace(origin + THEME, MOUNT + THEME)
        text = text.replace((origin + THEME).replace('/', '\/'), (MOUNT + THEME).replace('/', '\/'))
        for asset in local_paths:
            if asset.startswith(THEME + '/') or asset.endswith('.html'):
                continue
            text = text.replace(origin + asset, MOUNT + asset)
            text = text.replace((origin + asset).replace('/', '\/'), (MOUNT + asset).replace('/', '\/'))
    for reference in report['external_refs']:
        asset = unquote(urlsplit(reference['url']).path)
        if asset.startswith(THEME + '/') and asset not in local_paths:
            text = text.replace(MOUNT + asset, ORIGIN + asset)
    font = font_sources.get(str(path.relative_to(TARGET)))
    if font:
        file, value = font
        format = {'.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype'}[file.suffix]
        text = re.sub(r'src\s*:[^;]+;', 'src:url("' + value + '") format("' + format + '");', text)
    if path.name == 'app.js':
        text = text.replace('/c-products/draco/', '/c-storytelling-v2/draco/')
        text = text.replace('/c-bottle/draco/', '/c-storytelling-v2/draco/')
        text = text.replace('"".concat(this.themeDirectory,"/src/bemit/09-components/c-storytelling-v2/draco/")', '"/string-tune/libs/draco/"')
        text = text.replace('window.location.href="/".concat(i)', 'window.location.href="/revoltosa/".concat(i)')
    if path.suffix == '.html':
        text = re.sub(r'<script\b.*?</script>', scripts, text, flags=re.S | re.I)
        text = re.sub(r'<noscript>\s*<iframe.*?googletagmanager.*?</noscript>', '', text, flags=re.S | re.I)
        text = re.sub(r'\bhref=(["\'])([^"\']*)\1', rebase_href, text)
        text = re.sub(r'\baction=(["\'])[^"\']*\1', 'action="/revoltosa/"', text)
        text = text.replace('</head>', '<link rel="stylesheet" href="/revoltosa/replica.css"><script src="/revoltosa/replica.js" defer></script></head>', 1)
        text = compact_html(text)
    if path.suffix == '.webmanifest':
        data = json.loads(text)
        data.update(start_url=MOUNT + '/', scope=MOUNT + '/')
        for icon in data.get('icons', []):
            icon['src'] = ORIGIN + THEME + '/imgs/favicon/' + icon['src'].split('/')[-1]
        text = json.dumps(data, ensure_ascii=False)
    path.write_text(text)

(TARGET / 'replica.css').write_text('.b-header{z-index:10000!important}.b-menu{z-index:10001!important}\n')

(TARGET / 'replica.js').write_text('''(() => {
  const banner = document.querySelector('#kncc-banner');
  const key = 'revoltosa-replica-consent';
  function show(value) { if (banner) banner.style.display = value ? 'block' : 'none'; }
  window.knccEditConsent = () => show(true);
  let consent = null; try { consent = localStorage.getItem(key); } catch {}
  show(!consent);
  if (banner) banner.addEventListener('click', event => {
    const button = event.target.closest('[data-kncc]'); if (!button) return;
    const action = button.dataset.kncc;
    if (action === 'toggle-details') {
      const details = banner.querySelector('.kncc-details');
      if (details) details.style.display = details.style.display === 'none' ? 'block' : 'none';
    } else {
      try { localStorage.setItem(key, action); } catch {}
      show(false);
    }
  });
  window.addEventListener('submit', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const form = event.target;
    let notice = form.querySelector('[data-replica-feedback]');
    if (!notice) { notice = document.createElement('p'); notice.dataset.replicaFeedback = ''; notice.setAttribute('role','status'); form.appendChild(notice); }
    notice.textContent = 'Formulario de demostración. No se ha enviado ningún mensaje.';
    notice.style.cssText = 'padding:20px 0;font:14px/1.5 sans-serif;color:inherit';
  }, true);
})();
''')

print('La Revoltosa:', len(pages), 'pages;', len(selected), 'local resources;', len(textures), 'canvas texture URLs')
missing = [name for name in textures if not (TARGET / name.lstrip('/')).is_file()]
if missing:
    print('Canvas textures still to download:', *missing, sep='\n')
