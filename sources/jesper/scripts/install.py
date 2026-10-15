"""Install the supplied public portfolio reference below /jesper/.

Keep the two Nuxt apps isolated: each has its own runtime, route base and assets.
The portfolio's CMS data is frozen locally; original CMS credentials are removed.
"""
from pathlib import Path
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/private/tmp/jesper-original')
DEST = ROOT / 'public'
ORIGIN = 'https://agrumea-farm-replica-zufar.wiry-globe-6747.chatgpt.site'
BASE = '/jesper/'

assert (SOURCE / '_payload.json').exists(), 'Download the public reference first.'
for path in SOURCE.rglob('*'):
    rel = path.relative_to(SOURCE)
    if not path.is_file() or rel.parts[0] == 'scripts' or path.name == 'report.json':
        continue
    target = DEST / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)

# Decode only the already-rendered public CMS snapshot, without calling its API.
flat = json.loads((SOURCE / '_payload.json').read_text())
memo = {}
def resolve(index):
    if index < 0:
        return None
    if index in memo:
        return memo[index]
    value = flat[index]
    if isinstance(value, list):
        if value and isinstance(value[0], str) and value[0] in ('Reactive', 'ShallowReactive', 'Ref', 'ShallowRef'):
            return resolve(value[1])
        result = []
        memo[index] = result
        result.extend(resolve(v) for v in value)
        return result
    if isinstance(value, dict):
        result = {}
        memo[index] = result
        result.update((k, resolve(v)) for k, v in value.items())
        return result
    memo[index] = value
    return value

data = resolve(0)['data']
snapshot = {key: data[key] for key in ('projects', 'featured', 'site')}
snapshot['site']['noIndex'] = True
(DEST / 'data').mkdir(exist_ok=True)
(DEST / 'data/site.json').write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))

for path in DEST.rglob('*'):
    if path.suffix not in ('.html', '.js', '.css', '.json', '.txt', '.xml'):
        continue
    text = path.read_text()
    if path.suffix == '.html':
        text = re.sub(r'((?:href|src|data-src)=")/(?!/|jesper/)', r'\1/jesper/', text)
        text = re.sub(r'<script\b[^>]*src="https://static\.cloudflareinsights\.com/[^>]*>\s*</script>', '', text)
        text = text.replace('baseURL:"/"', 'baseURL:"/jesper/"')
        text = re.sub(r'datoToken:"[^\"]*"', 'datoToken:""', text)
        text = text.replace('</head>', '<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/jesper/replica.css"></head>')
        text = text.replace('</body>', '<nav class="replica-switcher" aria-label="Other websites"><a class="agrumea-return" href="/en/" aria-label="Return to Agrumea Farm">← Agrumea Farm</a><a class="ricardo-switch" href="/ricardo/">Ricardo Chance ↗</a></nav></body>')
    # These are public asset paths, not application routes. Route strings such
    # as /full and /projects/:slug stay app-relative under Nuxt's baseURL.
    for folder in ('glyphs', 'textures', 'basis', 'models'):
        text = text.replace('/' + folder + '/', BASE + folder + '/')
    if path.suffix == '.js':
        # Plain DOM anchors also need the mounted prefix. Keep Vue Router's
        # `to` and navigation arguments app-relative under its history base.
        text = re.sub(r'(\bhref:\s*[`"\'])/(?!/|jesper/)', r'\1/jesper/', text)
    if path.suffix == '.css' or path.suffix == '.html':
        text = re.sub(r'(url\(["\']?)/_nuxt/', r'\1/jesper/_nuxt/', text)
    text = text.replace('https://jesperlandberg.com', ORIGIN + '/jesper')
    text = text.replace('https:\\u002F\\u002Fjesperlandberg.com', (ORIGIN + '/jesper').replace('/', '\\u002F'))
    path.write_text(text)

# Freeze the $dato provider on our local snapshot. Hydration keeps using the
# original per-route payloads; later lazy requests and prefetches stay local.
main = DEST / '_nuxt/DZyj3ghP.js'
text = main.read_text()
start = text.index('tI=Pn(')
end = text.index(';function nI(', start)
provider = '''tI=Pn(()=>{let cached;const snapshot=()=>cached??=(fetch("/jesper/data/site.json").then(r=>{if(!r.ok)throw new Error("Portfolio data unavailable");return r.json()}));return{provide:{dato:{request:async()=>{throw new Error("This replica uses a local portfolio snapshot")},projects:async()=>(await snapshot()).projects,featured:async()=>(await snapshot()).featured,site:async()=>(await snapshot()).site}}}})'''
text = text[:start] + provider + text[end:]
main.write_text(text)

(DEST / 'replica.css').write_text('''/* Small, persistent links to the other websites. */
/* Keep the original flat HUD labels readable while its GPU text initializes. */
:root body .fixed.inset-0.z-40.justify-between{-webkit-text-fill-color:#fff!important}
.replica-switcher{position:fixed;z-index:100;left:50%;top:40px;transform:translateX(-50%);display:flex;align-items:center;gap:20px;white-space:nowrap;mix-blend-mode:difference}
.replica-switcher a{color:#fff!important;-webkit-text-fill-color:#fff!important;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:400;line-height:1;text-transform:uppercase;text-decoration:none;letter-spacing:.02em;opacity:.75;pointer-events:auto;transition:opacity .2s}
.replica-switcher a:hover,.replica-switcher a:focus-visible{opacity:1}
.replica-switcher a:focus-visible{outline:1px solid #fff;outline-offset:7px}
@media(max-width:650px){.replica-switcher{top:25px;gap:12px}.replica-switcher a{font-size:8px}}
''')
(DEST / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
print(json.dumps({'destination': str(DEST), 'pages': len(list(DEST.rglob('index.html'))),
                  'projects': len(snapshot['projects']), 'featured': len(snapshot['featured']),
                  'cms': 'local snapshot; original credentials removed'}, ensure_ascii=False))
