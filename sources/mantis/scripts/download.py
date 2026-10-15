#!/usr/bin/env python3
"""Archive Mantis's public Astro frontend while deliberately omitting videos.

Run: python3 websites/mantis/scripts/download.py [destination]
This read-only bounded crawl only performs public GET requests. It follows
same-origin pages and static dependencies, never APIs, forms, or video media.
"""
import concurrent.futures as cf
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = 'https://www.mantis.works'
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/private/tmp/mantis-original')
HOSTS = {'mantis.works', 'www.mantis.works'}
ROUTES = ['/', '/lab/strands/', '/lab/up-next/', '/lab/vimeo/',
          '/work/find-your-edge-google-cloud/', '/work/plaid-effects-26/',
          '/work/shopify-dot-dev-26/', '/work/sui-eve-fest/']
EXT = re.compile(r'\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|glb|gltf|bin|ktx2|wasm|json|hdr|exr|basis|ico|webmanifest|xml)(?:[?#].*)?$', re.I)
VIDEO = re.compile(r'(?:\.(?:mp4|webm|mov|m4v|m3u8|mpd)(?:[?#].*)?$|/(?:videos|video)/|stream\.mux\.com|player\.vimeo\.com|youtube\.com/embed)', re.I)
QUOTED = re.compile(r'''["'`]([^"'`\s<>]{2,2000})["'`]''')
URL = re.compile(r'''https?://[^\s"'<>`\\)]+''')
CSS = re.compile(r'''url\(["']?([^"')]+)["']?\)''')
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; StaticPreviewArchive/1.0)'}

class Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.candidates = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key, value in attrs.items():
            if key in ('src', 'href', 'poster', 'data-src', 'data-video-src') and value:
                self.candidates.append(value)
            elif key == 'srcset' and value:
                self.candidates.extend(item.strip().split(' ')[0] for item in value.split(','))
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])

def destination(url, kind):
    path = urllib.parse.unquote(urllib.parse.urlsplit(url).path).lstrip('/')
    if '..' in Path(path).parts:
        raise ValueError('Invalid path')
    return ROOT / path / 'index.html' if kind == 'route' else ROOT / path

def fetch(job):
    url, kind = job
    dest = destination(url, kind)
    if VIDEO.search(url):
        return {'url': url, 'kind': kind, 'skipped_video': True}, b''
    try:
        if dest.is_file() and dest.stat().st_size:
            data = dest.read_bytes()
            return {'url': url, 'kind': kind, 'path': str(dest.relative_to(ROOT)), 'status': 200, 'bytes': len(data), 'cached': True}, data
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=40) as response:
            ctype = response.headers.get('Content-Type', '')
            if ctype.startswith('video/'):
                return {'url': url, 'kind': kind, 'skipped_video': True}, b''
            if kind == 'asset' and 'text/html' in ctype:
                raise ValueError('Expected static asset, received HTML')
            data = response.read()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return {'url': url, 'kind': kind, 'path': str(dest.relative_to(ROOT)), 'status': response.status, 'bytes': len(data), 'content_type': ctype, 'final_url': response.geturl()}, data
    except Exception as exc:
        return {'url': url, 'kind': kind, 'error': str(exc)}, b''

def discover(data, source, kind):
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        return set(), set(), set(), set(), set()
    text = text.replace('\\/', '/').replace('\\u002F', '/').replace('\\u0026', '&')
    parser = Markup()
    if kind == 'route':
        parser.feed(text)
    candidates = QUOTED.findall(text) + URL.findall(text) + CSS.findall(text) + parser.candidates
    local, external, videos, apis, pages = set(), set(), set(), set(), set()
    for candidate in candidates:
        candidate = html.unescape(candidate).strip().rstrip(',;')
        if not candidate or len(candidate) > 1600 or '${' in candidate or candidate.startswith(('data:', 'mailto:', 'tel:', '#', 'javascript:')):
            continue
        if not re.fullmatch(r'[A-Za-z0-9_./?=&%:+#@~!(),\-]+', candidate):
            continue
        if not candidate.startswith(('/', './', '../', 'http')):
            if not (source.split('?')[0].endswith(('.js', '.css')) and EXT.search(candidate)):
                continue
        full = urllib.parse.urljoin(source, candidate)
        p = urllib.parse.urlsplit(full)
        # Vite's import maps retain source module names as object keys. These
        # names are not fetched by the browser; the adjacent hashed imports are.
        if p.path.startswith(('/pages/', '/modules/')) or p.path == '/_astro/.css':
            continue
        if p.path.startswith('/_astro/') and p.path.endswith('.js') and Path(p.path).name.count('.') < 2:
            continue
        if VIDEO.search(full):
            videos.add(full)
            continue
        if '/api/' in p.path:
            apis.add(full)
            continue
        if not EXT.search(candidate):
            continue
        if p.netloc in HOSTS:
            local.add(urllib.parse.urlunsplit(('https', 'www.mantis.works', p.path, p.query, '')))
        elif p.scheme in ('http', 'https'):
            external.add(full)
    for candidate in parser.links:
        full = urllib.parse.urljoin(source, html.unescape(candidate))
        p = urllib.parse.urlsplit(full)
        if p.netloc in HOSTS and not p.query and not EXT.search(p.path) and not VIDEO.search(full) and not p.path.startswith('/api/'):
            path = p.path.rstrip('/') + '/' if p.path != '/' else '/'
            pages.add(BASE + path)
    return local, external, videos, apis, pages

def main():
    started = time.time()
    ROOT.mkdir(parents=True, exist_ok=True)
    seed = Path('/private/tmp/mantis-home.html')
    if seed.is_file() and not (ROOT / 'index.html').is_file():
        (ROOT / 'index.html').write_bytes(seed.read_bytes())
    jobs = [(BASE + route, 'route') for route in ROUTES]
    jobs += [(BASE + path, 'asset') for path in ['/sitemap-index.xml', '/sitemap-0.xml']]
    seen, remotes, videos, apis, route_set = set(), set(), set(), set(), set(ROUTES)
    results = []
    with cf.ThreadPoolExecutor(max_workers=10) as pool:
        for iteration in range(20):
            jobs = list({(urllib.parse.urlsplit(u).path.rstrip('/') or '/', k): (u, k) for u, k in jobs if (urllib.parse.urlsplit(u).path.rstrip('/') or '/', k) not in seen}.values())
            if not jobs:
                break
            seen.update((urllib.parse.urlsplit(u).path.rstrip('/') or '/', k) for u, k in jobs)
            next_jobs = []
            for result, data in pool.map(fetch, jobs):
                results.append(result)
                if 'error' not in result and not result.get('skipped_video'):
                    local, remote, skipped, api, pages = discover(data, result['url'], result['kind'])
                    remotes.update(remote)
                    videos.update(skipped)
                    apis.update(api)
                    next_jobs.extend((u, 'asset') for u in local)
                    for url in sorted(pages):
                        path = urllib.parse.urlsplit(url).path
                        if path not in route_set and len(route_set) < 60:
                            route_set.add(path)
                            next_jobs.append((url, 'route'))
            print(f'Pass {iteration + 1}: {len(jobs)} requests; {len(results)} total; {len(videos)} video references skipped', flush=True)
            jobs = next_jobs
            if len(results) > 800:
                break
    report = {'base_url': BASE, 'framework': 'Astro static HTML, Barba.js navigation with JS module loaders',
              'routes': sorted(route_set), 'resources': results, 'remote_assets': sorted(remotes),
              'skipped_video_references': sorted(videos), 'api_endpoints': sorted(apis),
              'files': len([r for r in results if 'path' in r]), 'bytes': sum(r.get('bytes', 0) for r in results),
              'errors': [r for r in results if 'error' in r], 'elapsed_seconds': round(time.time() - started, 2),
              'video_policy': 'No video response bodies downloaded. All video sources/streams deliberately skipped.'}
    (ROOT / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ('files', 'bytes', 'routes', 'api_endpoints', 'elapsed_seconds')}), flush=True)
    print('Errors: ' + str(len(report['errors'])), flush=True)

if __name__ == '__main__':
    main()
