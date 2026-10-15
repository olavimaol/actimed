#!/usr/bin/env python3
"""Mirror Ricardo Chance's public frontend, without calling contact APIs.

Run: python3 websites/ricardo/scripts/download.py [destination]
Only the public pages and same-origin static resources are downloaded. The
bounded crawl follows script/CSS dependencies, not arbitrary application routes.
"""
import concurrent.futures as cf
import html
import json
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = 'https://www.ricardochance.com'
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/private/tmp/ricardo-original')
ROUTES = ['/', '/en', '/es', '/about', '/work', '/en/about', '/en/work', '/es/about', '/es/work']
EXT = re.compile(r'\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|mp4|webm|mov|glb|gltf|bin|ktx2|wasm|json|hdr|exr|basis|ico|webmanifest)(?:[?#].*)?$', re.I)
QUOTED = re.compile(r'''["'`]([^"'`\s<>]{2,2000})["'`]''')
URL = re.compile(r'''https?://[^\s"'<>`\\)]+''')
ATTR = re.compile(r'''(?:src|href|poster)=["']([^"']+)["']''')
CSS = re.compile(r'''url\(["']?([^"')]+)["']?\)''')
CHUNK = re.compile(r'''(?:/_next/)?static/(?:chunks|media)/[A-Za-z0-9_./~-]+\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg)''')
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; StaticPreviewArchive/1.0)'}

def destination(url, kind):
    path = urllib.parse.unquote(urllib.parse.urlsplit(url).path).lstrip('/')
    if '..' in Path(path).parts:
        raise ValueError('Invalid path')
    return ROOT / path / 'index.html' if kind == 'route' else ROOT / path

def fetch(job):
    url, kind = job
    dest = destination(url, kind)
    try:
        if dest.is_file() and dest.stat().st_size:
            data = dest.read_bytes()
            return {'url': url, 'kind': kind, 'path': str(dest.relative_to(ROOT)), 'status': 200, 'bytes': len(data), 'cached': True}, data
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=45) as response:
            data = response.read()
            # A mistyped public file can be rewritten by Next middleware to 404 HTML.
            ctype = response.headers.get('Content-Type', '')
            if kind == 'asset' and 'text/html' in ctype:
                raise ValueError('Expected asset, received HTML')
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return {'url': url, 'kind': kind, 'path': str(dest.relative_to(ROOT)), 'status': response.status, 'bytes': len(data), 'content_type': ctype, 'final_url': response.geturl()}, data
    except Exception as exc:
        return {'url': url, 'kind': kind, 'error': str(exc)}, b''

def discover(data, source):
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        return set(), set(), set()
    text = text.replace('\\/', '/').replace('\\u002F', '/').replace('\\u0026', '&')
    candidates = QUOTED.findall(text) + URL.findall(text) + ATTR.findall(text) + CSS.findall(text) + CHUNK.findall(text)
    local, external, api = set(), set(), set()
    for candidate in candidates:
        candidate = html.unescape(candidate).strip().rstrip(',;')
        if not candidate or len(candidate) > 1600 or '${' in candidate or candidate.startswith(('data:', 'mailto:', 'tel:', '#', 'javascript:')):
            continue
        if candidate.startswith('/api/'):
            api.add(candidate)
            continue
        if candidate.startswith('static/chunks/') or candidate.startswith('static/media/'):
            candidate = '/_next/' + candidate
        if not re.fullmatch(r'[A-Za-z0-9_./?=&%:+#@~!(),\-]+', candidate):
            continue
        if not EXT.search(candidate):
            continue
        if not candidate.startswith(('/', './', '../', 'http')):
            # CSS font paths and loader-relative Next chunks are valid relative assets.
            if source.endswith('.css') or candidate.endswith('.wasm'):
                pass
            else:
                continue
        full = urllib.parse.urljoin(source, candidate)
        p = urllib.parse.urlsplit(full)
        if p.netloc in ('ricardochance.com', 'www.ricardochance.com'):
            local.add(urllib.parse.urlunsplit(('https', 'www.ricardochance.com', p.path, p.query, '')))
        elif p.scheme in ('http', 'https'):
            external.add(full)
    # Image resource URLs can be escaped in inline Next Flight strings.
    for item in re.findall(r'/(?:images|videos|models|textures|audio|og|icons)/[A-Za-z0-9_./%\-]+\.(?:png|jpg|jpeg|webp|avif|svg|gif|mp4|webm|glb|gltf|hdr|exr|ktx2|mp3)', text):
        local.add(BASE + item)
    return local, external, api

def main():
    started = time.time()
    ROOT.mkdir(parents=True, exist_ok=True)
    seed = Path('/private/tmp/ricardo-original.html')
    if seed.is_file() and not (ROOT / 'index.html').is_file():
        (ROOT / 'index.html').write_bytes(seed.read_bytes())
    jobs = [(BASE + r, 'route') for r in ROUTES]
    jobs += [(BASE + x, 'asset') for x in ['/site.webmanifest', '/favicon.ico', '/favicon.svg']]
    seen, remotes, apis = set(), set(), set()
    results = []
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for iteration in range(16):
            jobs = list({(urllib.parse.urlsplit(u).path, k): (u, k) for u, k in jobs if (urllib.parse.urlsplit(u).path, k) not in seen}.values())
            if not jobs:
                break
            seen.update((urllib.parse.urlsplit(u).path, k) for u, k in jobs)
            next_jobs = []
            for result, data in pool.map(fetch, jobs):
                results.append(result)
                if 'error' not in result:
                    local, remote, api = discover(data, result['url'])
                    remotes.update(remote)
                    apis.update(api)
                    next_jobs.extend((u, 'asset') for u in local)
            print(f'Pass {iteration + 1}: {len(jobs)} requests; {len(results)} total; {len(remotes)} external assets', flush=True)
            jobs = next_jobs
            if len(results) > 600:
                break
    report = {'base_url': BASE, 'routes': ROUTES, 'resources': results,
              'remote_assets': sorted(remotes), 'api_endpoints': sorted(apis),
              'contact_delivery': 'Next.js Server Action sendContactEmail in 0zqyprg6jkh0b.js; never invoked by this downloader',
              'expected_source_missing_assets': ['/icons/icon-16.png', '/icons/icon-32.png', '/icons/icon-192.png'],
              'mount_notes': ['Turbopack dynamic chunk prefix is /_next/', 'Next-intl locale/path hooks and normalizeRoutePath expect the original unmounted path', 'Static hosting navigation must not depend on origin RSC or Server Action requests', 'Vercel toolbar is development tooling, not required site content'],
              'files': len([r for r in results if 'path' in r]),
              'bytes': sum(r.get('bytes', 0) for r in results),
              'errors': [r for r in results if 'error' in r],
              'elapsed_seconds': round(time.time() - started, 2)}
    (ROOT / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ('files', 'bytes', 'api_endpoints', 'elapsed_seconds')}), flush=True)
    print('Errors: ' + str(len(report['errors'])), flush=True)

if __name__ == '__main__':
    main()
