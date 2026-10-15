#!/usr/bin/env python3
"""Mirror the public AMANATION pages and assets for a static replica.

Only GET requests are used. No WordPress write, contact, admin or analytics
endpoint is requested. Query versions are collapsed because they contain cache
versions only; pagination remains separate directories. Default cap: 400 pages,
700 MiB total, 30 MiB per resource. Run with an optional destination argument.
"""
import concurrent.futures
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ORIGIN = 'https://www.amanation-official.com'
DEST = Path(sys.argv[1] if len(sys.argv) > 1 else '/private/tmp/amanation-original')
MAX_HTML = 400
BUDGET = 700 * 1024 * 1024
MAX_ASSET = 30 * 1024 * 1024
EXT = re.compile(r'\.(?:css|js|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot|mp4|webm|mov|glb|gltf|bin|json|wasm)(?:$|\?)', re.I)
ATTR = re.compile(r'(?<![\w-])(?:src|href|poster|data-(?:src|src-img|src-webp|lazy-src|lazy-src-webp|webp|poster|poster-image|poster-webp))\s*=\s*["\']([^"\']+)["\']', re.I)
ABS = re.compile(r'https?:(?:\\/|/){2}[^\s<>"\'`]+')
CSS = re.compile(r'url\(\s*["\']?([^\)"\']+)["\']?\s*\)', re.I)
QUOTED = re.compile(r'["\']([^"\'\n\r<>]{2,500}\.(?:css|js|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot|mp4|webm|mov|glb|gltf|bin|json|wasm)(?:\?[^"\'\n\r<>]*)?)["\']', re.I)
seen = set()
resources = []
routes = []
skipped = []
total = 0


def normalize(raw, base):
    raw = html.unescape(raw).replace('\\/', '/').strip()
    raw = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), raw)
    if re.search(r'\s+\d+(?:w|x)(?:,|$)', raw):
        return None
    if raw.startswith(('data:', 'blob:', '#', 'mailto:', 'tel:', 'javascript:')):
        return None
    u = urllib.parse.urlsplit(urllib.parse.urljoin(base, raw))
    if u.hostname not in ('www.amanation-official.com', 'amanation-official.com'):
        return None
    path = urllib.parse.unquote(u.path or '/')
    if '..' in Path(path).parts or path.startswith(('/wp-admin', '/wp-json', '/feed', '/xmlrpc', '/wp-login')):
        return None
    if path.endswith(('/feed/', '/embed/')):
        return None
    asset = bool(EXT.search(path))
    if asset:
        return ORIGIN + urllib.parse.quote(path, safe='/!$&()*+,;=:@-_.~'), path, 'asset'
    if not (path == '/' or path.startswith(('/company', '/creator', '/topics', '/contact', '/privacy'))):
        return None
    path = path.rstrip('/') + '/'
    match = re.search(r'/page/(\d+)/', path)
    if u.query:
        # Creator query links are the same static contact page; callers preserve
        # the query in HTML and installer can use creator-id JSON locally.
        query = urllib.parse.parse_qs(u.query)
        if any(k not in ('creator_id',) for k in query):
            return None
    return ORIGIN + urllib.parse.quote(path, safe='/!$&()*+,;=:@-_.~'), path, 'html'


def refs(content, base):
    values = ATTR.findall(content) + CSS.findall(content) + QUOTED.findall(content)
    for match in re.findall(r'(?:[\w-]*srcset[\w-]*)\s*=\s*["\']([^"\']+)["\']', content, re.I):
        values.extend(x.strip().split()[0] for x in match.split(',') if x.strip())
    values += ABS.findall(content)
    found = []
    for value in values:
        n = normalize(value, base)
        if n:
            found.append(n)
    return found


def target(path, kind):
    return DEST / path.lstrip('/') / 'index.html' if kind == 'html' else DEST / path.lstrip('/')


def download(item):
    url, path, kind = item
    dest = target(path, kind)
    try:
        if dest.exists():
            data = dest.read_bytes()
            if kind == 'html' and wrong_canonical(data, path):
                dest.unlink()
                return item, None, {'url': url, 'kind': kind, 'status': 'skipped-redirect'}
            return item, data, {'path': str(dest.relative_to(DEST)), 'url': url, 'kind': kind, 'bytes': len(data), 'status': 200, 'cached': True}
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; static-site-mirror/1.0)'})
        with urllib.request.urlopen(req, timeout=45) as response:
            size = int(response.headers.get('Content-Length', '0'))
            if size > MAX_ASSET:
                return item, None, {'url': url, 'kind': kind, 'status': 'skipped-large', 'bytes': size}
            data = response.read(MAX_ASSET + 1)
            if len(data) > MAX_ASSET:
                return item, None, {'url': url, 'kind': kind, 'status': 'skipped-large', 'bytes': len(data)}
        if kind == 'html' and wrong_canonical(data, path):
            return item, None, {'url': url, 'kind': kind, 'status': 'skipped-redirect'}
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return item, data, {'path': str(dest.relative_to(DEST)), 'url': url, 'kind': kind, 'bytes': len(data), 'status': 200}
    except Exception as error:
        return item, None, {'url': url, 'kind': kind, 'status': 'error', 'error': str(error)}


def wrong_canonical(data, path):
    content = data.decode('utf-8', errors='replace')
    canonical = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)', content, re.I)
    if not canonical:
        return False
    actual_path = urllib.parse.unquote(urllib.parse.urlsplit(canonical.group(1)).path).rstrip('/') + '/'
    return actual_path != path


def main():
    global total
    DEST.mkdir(parents=True, exist_ok=True)
    queue = [normalize(x, ORIGIN) for x in ['/', '/company/', '/creator/', '/topics/', '/contact/']]
    while queue and total < BUDGET:
        batch = []
        for item in queue:
            if not item or item[0] in seen:
                continue
            seen.add(item[0])
            if item[2] == 'html' and sum(x[2] == 'html' for x in batch) + len(routes) >= MAX_HTML:
                skipped.append({'url': item[0], 'reason': 'html-cap'})
                continue
            batch.append(item)
        queue = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            for item, data, record in pool.map(download, batch):
                if data is None:
                    skipped.append(record)
                    continue
                resources.append(record)
                total += len(data)
                url, path, kind = item
                if kind == 'html':
                    routes.append(path)
                if kind == 'html' or path.endswith(('.css', '.js', '.json', '.svg')):
                    queue.extend(refs(data.decode('utf-8', errors='replace'), url))
        report = {'origin': ORIGIN, 'routes': routes, 'resources': resources, 'skipped': skipped, 'total_bytes': total, 'html_cap': MAX_HTML, 'budget_bytes': BUDGET}
        (DEST / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps({'pages': len(routes), 'files': len(resources), 'queued': len(queue), 'MB': round(total / 1048576, 2), 'skipped': len(skipped)}), flush=True)
    print('Complete: ' + str(DEST / 'report.json'), flush=True)


if __name__ == '__main__':
    main()
