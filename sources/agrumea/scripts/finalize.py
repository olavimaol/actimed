"""Prepare the static replica for its own origin and remove original analytics."""
from pathlib import Path
import json
import re
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'public'
ORIGIN = 'https://agrumea-farm-replica-zufar.wiry-globe-6747.chatgpt.site'

# Keep the original font declarations and their license notices together.
font_css = urlopen('https://use.typekit.net/yey3ruw.css', timeout=30).read().decode()
font_css = re.sub(r'@import[^;]+;', '', font_css)
font_dir = DIST / 'fonts'
font_dir.mkdir(exist_ok=True)
for i, source in enumerate(re.findall(r'src:([^;]+);', font_css)):
    remote = re.search(r'url\("([^"]+)"\) format\("woff2"\)', source).group(1)
    filename = ['ivystyle-sans-600.woff2', 'ivystyle-sans-400.woff2', 'ivymode-400.woff2'][i]
    (font_dir / filename).write_bytes(urlopen(remote, timeout=30).read())
    font_css = font_css.replace(source, 'url("/fonts/' + filename + '") format("woff2")')
(font_dir / 'agrumea-fonts.css').write_text(font_css)


def decode_email(match):
    raw = bytes.fromhex(match.group(1))
    return 'mailto:' + ''.join(chr(c ^ raw[0]) for c in raw[1:])


for path in DIST.rglob('*'):
    if path.suffix not in ('.html', '.json', '.js', '.css', '.webmanifest'):
        continue
    text = path.read_text()
    text = re.sub(r'<script\b[^>]*src="https://static\.cloudflareinsights\.com/[^>]*>\s*</script>', '', text)
    text = text.replace('https://use.typekit.net/yey3ruw.css', '/fonts/agrumea-fonts.css')
    if path.suffix == '.js':
        # The original Imgix helper resolves relative images against its CDN.
        # Resolve our saved local assets against this replica's own origin.
        text = text.replace('new URL(s,"https://images.prismic.io")', 'new URL(s,window.location.origin)')
    text = re.sub(r'<link\b[^>]*rel="preconnect"[^>]*>', '', text)
    text = re.sub(r'/cdn-cgi/l/email-protection#([a-fA-F0-9]+)', decode_email, text)
    # Metadata and Nuxt runtime config belong to the new private site.
    for original, target in [('https://www.agrumeafarm.it', ORIGIN)]:
        text = text.replace(original, target)
        text = text.replace(original.replace('/', '\\u002F'), target.replace('/', '\\u002F'))
    if path.suffix == '.html':
        text = text.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">', 1)
    path.write_text(text)

(DIST / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(ROOT / 'reports/mirror-report.json').write_text(json.dumps({
    **json.loads((ROOT / 'reports/mirror-report.json').read_text()),
    'notes': ['The original Cloudflare email-protection endpoint is replaced with mailto links.', 'Original Google Analytics and Cloudflare beacon are disabled.'],
}, ensure_ascii=False, indent=2))
print('Prepared independent static site with local images, labels and fonts; original analytics removed.')
