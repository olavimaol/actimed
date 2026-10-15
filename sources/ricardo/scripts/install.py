#!/usr/bin/env python3
"""Install the public Ricardo frontend in an isolated /ricardo/ mount."""
import json
from pathlib import Path
import re
import shutil
import sys

from ricardo_runtime import patch_runtime

PROJECT = Path(__file__).resolve().parents[1]
STAGE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/private/tmp/ricardo-original')
TARGET = PROJECT / 'public'
MOUNT = '/ricardo'
ORIGIN = 'https://agrumea-farm-replica-zufar.wiry-globe-6747.chatgpt.site'

def repair_flight_text_lengths(html):
    """Flight text rows use byte lengths, including the JSON-LD metadata row."""
    def segment(match):
        packet = json.loads(match[1])
        if len(packet) > 1 and packet[0] == 1:
            stream = packet[1]
            edits = []
            for row in re.finditer(r'(?:^|\n)[a-f0-9]+:T([a-f0-9]+),', stream):
                # The source's text row contains a complete JSON-LD object.
                payload = stream[row.end():]
                _, end = json.JSONDecoder().raw_decode(payload)
                size = len(payload[:end].encode('utf-8'))
                edits.append((row.start(1), row.end(1), format(size, 'x')))
            for start, end, value in reversed(edits):
                stream = stream[:start] + value + stream[end:]
            packet[1] = stream
        return 'self.__next_f.push(' + json.dumps(packet, ensure_ascii=True) + ')</script>'
    return re.sub(r'self\.__next_f\.push\((\[.*?\])\)</script>', segment, html)

def main():
    report = json.loads((STAGE / 'report.json').read_text())
    resources = [r for r in report['resources'] if 'error' not in r]
    # Copy only verified public resources, excluding crawler diagnostic output.
    for item in resources:
        src = STAGE / item['path']
        dest = TARGET / item['path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
    assets = sorted(('/' + r['path'] for r in resources if r['kind'] == 'asset'), key=len, reverse=True)
    for p in TARGET.rglob('*'):
        if not p.is_file() or p.suffix not in ('.html', '.js', '.css', '.json', '.webmanifest', '.svg'):
            continue
        text = p.read_text()
        for asset in assets:
            # A prefix boundary avoids matching an already-mounted or absolute URL.
            text = re.sub(r'(?<![A-Za-z0-9_])' + re.escape(asset), MOUNT + asset, text)
        text = text.replace('https://www.ricardochance.com', ORIGIN + MOUNT)
        text = text.replace('https://ricardochance.com', ORIGIN + MOUNT)
        if p.name.startswith('turbopack-'):
            assert 'let t="/_next/"' in text
            text = text.replace('let t="/_next/"', 'let t="/ricardo/_next/"')
        if p.suffix == '.html':
            text = re.sub(r'href="(/(?:en|es)(?:/(?:about|work))?|/about|/work|/)"',
                          lambda m: 'href="' + MOUNT + m[1] + '"', text)
            # The original advertises these favicon files although they return 404.
            text = re.sub(r'<link[^>]+href="/icons/icon-(?:16|32|192)\.png"[^>]*>', '', text)
            text = re.sub(r'/icons/icon-(?:16|32|192)\.png', '/ricardo/favicon.ico', text)
            text = text.replace('</head>', '<link rel="stylesheet" href="/ricardo/replica.css"><script src="/ricardo/replica.js" defer></script></head>')
            text = repair_flight_text_lengths(text)
        if p.name == 'site.webmanifest':
            data = json.loads(text)
            data['id'] = MOUNT + '/'
            data['start_url'] = MOUNT + '/'
            data['scope'] = MOUNT + '/'
            text = json.dumps(data, indent=2)
        p.write_text(text)
    runtime_report = patch_runtime(TARGET)
    # The hook is intentionally independent of React's document hydration.
    (TARGET / 'replica.js').write_text('''(() => {
  function ready() {
    if (document.querySelector('.replica-site-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'replica-site-nav';
    nav.setAttribute('aria-label', 'Switch websites');
    nav.innerHTML = '<a href="/en/">← Agrumea Farm</a><span aria-hidden="true">/</span><a href="/jesper/">Jesper Landberg ↗</a>';
    document.body.appendChild(nav);
  }
  if (document.readyState !== 'complete') window.addEventListener('load', ready, {once: true});
  else ready();
})();
''')
    (TARGET / 'replica.css').write_text('''.replica-site-nav{position:fixed;z-index:9999;top:30px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;color:#e1dce9;font-family:Arial,sans-serif;font-size:10px;line-height:20px;white-space:nowrap}.replica-site-nav a{color:inherit;text-decoration:none;opacity:.75;transition:opacity .2s}.replica-site-nav a:hover,.replica-site-nav a:focus-visible{opacity:1}.replica-site-nav a:focus-visible{outline:1px solid currentColor;outline-offset:4px}.replica-site-nav span{opacity:.3}@media(max-width:600px){.replica-site-nav{top:66px;font-size:9px;gap:8px;background:#110a20a6;backdrop-filter:blur(8px);padding:1px 10px;border-radius:20px}}
''')
    print(f'Installed {len(resources)} public resources at {TARGET}; {runtime_report}')

if __name__ == '__main__':
    main()
