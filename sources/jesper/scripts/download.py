#!/usr/bin/env python3
"""Archive the public static frontend; never submit forms or call CMS APIs."""
import concurrent.futures as cf
import html
import json
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = 'https://jesperlandberg.com'
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/private/tmp/jesper-original')
ROUTES = ['', '/full', '/newsletter'] + ['/projects/' + x for x in (
    'nathan-riley', 'casa-di-solare', 'the-lookback', 'book-of-happiness',
    'dogelon-mars', 'gil-huybrecht', 'discoveryland', 'griflan')]
ASSET_EXT = re.compile(r'\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|mp4|webm|glb|gltf|bin|ktx2|wasm|json|hdr|exr|basis|ico)(?:[?#].*)?$', re.I)
QUOTED = re.compile(r'''["'`]([^"'`\s<>]{2,1500})["'`]''')
URL = re.compile(r'https?://[^\s"\'<>`\\)]+')
HTML_RESOURCE = re.compile(r'''(?:src|href|poster)=["']([^"']+)["']''')
CSS_RESOURCE = re.compile(r'''url\(["']?([^"')]+)["']?\)''')
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; StaticPreviewArchive/1.0)'}

def request(url, method='GET'):
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read() if method == 'GET' else b'', dict(response.headers), response.status, response.geturl()

def local_path(url, kind):
    p = urllib.parse.urlsplit(url).path
    if kind == 'route':
        return ROOT / p.lstrip('/') / 'index.html'
    return ROOT / p.lstrip('/')

def fetch(job):
    url, kind = job
    dest = local_path(url, kind)
    try:
        if dest.is_file() and dest.stat().st_size:
            data = dest.read_bytes()
            return {'url': url, 'path': str(dest.relative_to(ROOT)), 'kind': kind, 'status': 200, 'bytes': len(data), 'cached': True}, data
        data, headers, status, final = request(url)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return {'url': url, 'path': str(dest.relative_to(ROOT)), 'kind': kind,
                'status': status, 'bytes': len(data), 'content_type': headers.get('Content-Type', ''),
                'final_url': final}, data
    except Exception as exc:
        return {'url': url, 'kind': kind, 'error': str(exc)}, b''

def discover(data, source_url):
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        return set(), set()
    # Nuxt payload may JSON-escape slashes and unicode ampersands.
    text = text.replace('\\/', '/').replace('\\u002F', '/').replace('\\u0026', '&')
    if urllib.parse.urlsplit(source_url).path == '/textures/manifest.json':
        candidates = list(json.loads(text).values())
    else:
        candidates = QUOTED.findall(text) + URL.findall(text) + HTML_RESOURCE.findall(text) + CSS_RESOURCE.findall(text)
    local, remote = set(), set()
    for candidate in candidates:
        candidate = html.unescape(candidate).strip().rstrip(',;')
        if candidate.startswith(('data:', 'mailto:', 'tel:', '#', 'javascript:')):
            continue
        if len(candidate) > 1200 or '${' in candidate or not re.fullmatch(r'[A-Za-z0-9_./?=&%:+#@~\-]+', candidate):
            continue
        parsed = urllib.parse.urlsplit(candidate)
        if parsed.scheme and parsed.scheme not in ('http', 'https'):
            continue
        is_path = candidate.startswith(('/', './', '../', 'http'))
        is_file = ASSET_EXT.search(candidate)
        if not is_path and not is_file:
            continue
        if urllib.parse.urlsplit(source_url).path.startswith('/_nuxt/') and candidate in ('_payload.json', 'basis_transcoder.wasm', '.css'):
            continue
        full = urllib.parse.urljoin(source_url, candidate)
        parts = urllib.parse.urlsplit(full)
        if parts.netloc in ('jesperlandberg.com', 'www.jesperlandberg.com'):
            if is_file:
                # Version query parameters do not affect local filenames.
                full = urllib.parse.urlunsplit(('https', 'jesperlandberg.com', parts.path, parts.query, ''))
                local.add(full)
        elif parts.scheme in ('http', 'https'):
            if 'datocms-assets.com' in parts.netloc:
                remote.add(full)
    return local, remote

def main():
    started = time.time()
    jobs = [(BASE + (route or '/'), 'route') for route in ROUTES]
    jobs += [(BASE + route + '/_payload.json', 'payload') for route in ROUTES]
    jobs += [(BASE + path, 'asset') for path in ('/textures/manifest.json', '/glyphs/sans-400.json', '/glyphs/sans-400.bin', '/glyphs/sans-500.json', '/glyphs/sans-500.bin', '/basis/basis_transcoder.js', '/basis/basis_transcoder.wasm', '/models/award.glb', '/models/llama.glb', '/_nuxt/ABCDiatypePlusVariable.DURmIfav.woff2', '/_nuxt/builds/meta/dae78082-791f-45e5-83d8-7af79c012859.json', '/_nuxt/builds/latest.json', '/llms.txt', '/sitemap.xml')]
    seen = set()
    results = []
    remotes = set()
    # A path may be mentioned with multiple cache queries. Fetch it once.
    def key(job):
        return (urllib.parse.urlsplit(job[0]).path, job[1])
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        iteration = 0
        while jobs:
            jobs = list({key(job): job for job in jobs if key(job) not in seen}.values())
            if not jobs:
                break
            seen.update(key(job) for job in jobs)
            next_jobs = []
            for result, data in pool.map(fetch, jobs):
                results.append(result)
                if 'error' not in result:
                    local, remote = discover(data, result['url'])
                    remotes.update(remote)
                    next_jobs.extend((u, 'asset') for u in local)
            iteration += 1
            print(f'Pass {iteration}: fetched {len(jobs)}, total {len(results)}, queued {len(next_jobs)}, remote assets {len(remotes)}', flush=True)
            if iteration > 20 or len(results) > 1200:
                print('Bound reached; stopping crawl', flush=True)
                break
            jobs = next_jobs
    remote_inventory = [{'url': u} for u in sorted(remotes)]
    manifest_path = ROOT / 'textures/manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    texture_entries = [{'source_key': key, 'path': path, 'exists': (ROOT / path.lstrip('/')).is_file(), 'bytes': (ROOT / path.lstrip('/')).stat().st_size if (ROOT / path.lstrip('/')).is_file() else None} for key, path in manifest.items()]
    unique_files = {r['path']: r for r in results if 'path' in r}
    report = {'base_url': BASE, 'routes': ROUTES, 'resources': results,
              'remote_assets': remote_inventory,
              'texture_manifest': {'count': len(texture_entries), 'entries': texture_entries, 'missing': [entry['path'] for entry in texture_entries if not entry['exists']]},
              'unique_file_count': len(unique_files), 'unique_file_bytes': sum(r['bytes'] for r in unique_files.values()),
              'ignored_reference_notes': ['manifest object keys are source CDN paths, only values are local texture files', 'bare Nuxt runtime helper names _payload.json, .css, basis_transcoder.wasm are not asset paths', 'dynamic templates and non-path JavaScript strings are ignored'],
              'errors': [r for r in results if 'error' in r],
              'elapsed_seconds': round(time.time() - started, 2)}
    (ROOT / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'files': len(results) - len(report['errors']), 'errors': len(report['errors']),
                      'bytes': sum(r.get('bytes', 0) for r in results), 'remote_assets': len(remotes),
                      'report': str(ROOT / 'report.json')}, indent=2), flush=True)

if __name__ == '__main__':
    main()
