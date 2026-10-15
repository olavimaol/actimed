#!/usr/bin/env python3
"""Create a self-contained static replica from the supplied public reference.

Only public frontend documents and their assets are fetched. No accounts,
cookies, form submissions, or private service data are accessed.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import Request, urlopen
import html
import json
import re
import time

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'public'
(ROOT / 'reports').mkdir(exist_ok=True)
ORIGIN = 'https://www.agrumeafarm.it'
seen = set()
errors = []
documents = {}
assets = set()
pages = {'/', '/en'}
cdn_assets = {}


def fetch(url):
    for attempt in range(3):
        try:
            req = Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; ReferenceReplica/1.0)'})
            with urlopen(req, timeout=45) as response:
                return response.read(), response.headers.get('Content-Type', '')
        except Exception:
            if attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))


def normalized(text):
    return html.unescape(text.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&'))


class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'a' and d.get('href'):
            u = urlsplit(urljoin(ORIGIN, d['href']))
            if u.netloc == 'www.agrumeafarm.it' and not u.query and not u.path.startswith(('/preview', '/slice-simulator', '/cdn-cgi/')):
                if not Path(u.path).suffix:
                    pages.add(u.path.rstrip('/') or '/')
        for key in ('href', 'src', 'poster', 'data-src'):
            val = d.get(key, '')
            if val.startswith('/') and not val.startswith('//') and Path(urlsplit(val).path).suffix:
                assets.add(urlsplit(val).path)


def discover(text, source_path):
    text = normalized(text)
    if source_path.endswith('.html'):
        Links().feed(text)
    # All Nuxt chunks, including lazy route components and their styles.
    for match in re.findall(r'["\']((?:\./|/_nuxt/)[^"\'\s]+\.(?:js|css|json))["\']', text):
        assets.add('/_nuxt/' + match[2:] if match.startswith('./') else match)
    for match in re.findall(r'(?<![A-Za-z0-9])(/(?:images|fonts)/[^"\'\s<>`?;)]+\.(?:svg|png|webp|jpe?g|woff2?|avif|mp4))', text):
        assets.add(match)
    # Images and label textures live on two public Prismic CDNs.
    for match in re.findall(r'https://(?:images\.prismic\.io|agrumea-site\.cdn\.prismic\.io)/[^"\'\s<>`\\)]+', text):
        u = urlsplit(match)
        if not re.search(r'\.(?:webp|png|jpe?g|svg|gif|avif|mp4|pdf)$', u.path, re.I):
            continue
        local = '/assets/' + u.netloc + unquote(u.path)
        cdn_assets[(u.netloc, u.path)] = local


def save_document(path, data):
    target = DIST / path.lstrip('/')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    documents[path] = data.decode('utf-8')
    discover(documents[path], path)


def get_page(path):
    data, kind = fetch(ORIGIN + path)
    return path, data, kind


while True:
    batch = sorted(pages - seen)
    if not batch:
        break
    seen.update(batch)
    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs = [pool.submit(get_page, p) for p in batch]
        for job in as_completed(jobs):
            try:
                path, data, kind = job.result()
                out = path.rstrip('/') + '/index.html' if path != '/' else '/index.html'
                save_document(out, data)
                payload_path = path.rstrip('/') + '/_payload.json'
                payload, _ = fetch(ORIGIN + payload_path)
                save_document(payload_path, payload)
                print('page', path, flush=True)
            except Exception as exc:
                errors.append(str(exc))

assets.update({'/favicon.ico', '/favicon.svg', '/favicon-96x96.png', '/apple-touch-icon.png', '/site.webmanifest', '/_nuxt/builds/latest.json'})
for text in list(documents.values()):
    for build in re.findall(r'buildId:["\']([^"\']+)', text):
        assets.add('/_nuxt/builds/meta/' + build + '.json')

fetched_assets = set()
while True:
    batch = sorted(assets - fetched_assets)
    if not batch:
        break
    fetched_assets.update(batch)
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs = {pool.submit(fetch, ORIGIN + p): p for p in batch}
        for job in as_completed(jobs):
            path = jobs[job]
            try:
                data, kind = job.result()
                if any(path.endswith(ext) for ext in ('.js', '.css', '.json', '.svg', '.webmanifest')):
                    save_document(path, data)
                else:
                    target = DIST / path.lstrip('/')
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
            except Exception as exc:
                errors.append(path + ': ' + str(exc))
    print('frontend assets', len(fetched_assets), flush=True)


def get_cdn(item):
    (host, path), local = item
    url = 'https://' + host + path
    if host == 'images.prismic.io' and not path.lower().endswith(('.svg', '.pdf', '.mp4')):
        url += '?auto=format%2Ccompress&w=1920'
    data, _ = fetch(url)
    target = DIST / local.lstrip('/')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return local


with ThreadPoolExecutor(max_workers=10) as pool:
    jobs = {pool.submit(get_cdn, item): item for item in cdn_assets.items()}
    for i, job in enumerate(as_completed(jobs), 1):
        try:
            job.result()
        except Exception as exc:
            errors.append(str(jobs[job]) + ': ' + str(exc))
        if i % 30 == 0:
            print('images', i, '/', len(cdn_assets), flush=True)

# Rewrite the CDN prefixes in both regular strings and Nuxt serialized JSON.
replacements = {
    'https://images.prismic.io/': '/assets/images.prismic.io/',
    'https://agrumea-site.cdn.prismic.io/': '/assets/agrumea-site.cdn.prismic.io/',
}
for path, text in documents.items():
    for source, target in replacements.items():
        text = text.replace(source, target)
        text = text.replace(source.replace('/', '\\u002F'), target.replace('/', '\\u002F'))
        text = text.replace(source.replace('/', '\\/'), target.replace('/', '\\/'))
    # The replica must not send analytics events to the original business.
    text = text.replace('gaMeasurementId:"G-PNTJV1LQLZ"', 'gaMeasurementId:""')
    text = text.replace('"G-PNTJV1LQLZ"', '""')
    (DIST / path.lstrip('/')).write_text(text)

report = {'pages': sorted(pages), 'frontend_assets': len(fetched_assets), 'images': len(cdn_assets), 'errors': errors}
(ROOT / 'reports/mirror-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
