#!/usr/bin/env python3
"""Mirror the public StringTune presentation and linked demos without changing them.

Usage: python3 websites/string-tune/scripts/download.py [/private/tmp/stringtune-original]
All source files retain their upstream bytes. report.json records every resource.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag, unquote
from urllib.request import Request, urlopen
import json, re, sys, time

ORIGIN = 'https://string-tune.fiddle.digital'
DEST = Path(sys.argv[1] if len(sys.argv) > 1 else '/private/tmp/stringtune-original')
EXT = re.compile(r'\.(?:js|mjs|css|png|jpe?g|webp|gif|svg|ico|avif|woff2?|ttf|otf|eot|mp4|webm|mov|mp3|ogg|wav|glb|gltf|bin|wasm|ktx2|json|hdr|exr|webmanifest|pdf|txt)(?:[?#].*)?$', re.I)
ROUTE_CAP = 60

class HtmlRefs(HTMLParser):
    def __init__(self):
        super().__init__(); self.assets=[]; self.routes=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        for key in ('src','data-src','poster','data-poster'):
            if a.get(key): self.assets.append(a[key])
        if a.get('srcset'):
            self.assets += [x.strip().split(' ')[0] for x in a['srcset'].split(',')]
        if a.get('href'):
            if tag=='a': self.routes.append(a['href'])
            elif tag=='link': self.assets.append(a['href'])

seen=set(); pending={ORIGIN+'/'}; routes=set(); resources=[]; external=set(); started=time.time()
# Explicit runtime-generated assets and known linked tutorial route templates.
for decoder in ('draco_decoder.js','draco_wasm_wrapper.js','draco_decoder.wasm'):
    pending.add(ORIGIN+'/libs/draco/'+decoder)

def canonical(raw,base):
    raw=unescape(raw).replace('\\/','/').strip()
    if not raw or raw.startswith(('data:','javascript:','mailto:','tel:','#','blob:')) or '${' in raw: return None
    u=urldefrag(urljoin(base,raw))[0]
    p=urlparse(u)
    if p.netloc!=urlparse(ORIGIN).netloc:
        if p.scheme in ('http','https'): external.add(u)
        return None
    if p.scheme not in ('http','https'): return None
    # No assets on this site need query variants.
    return ORIGIN+(p.path or '/')

def local_path(url):
    p=unquote(urlparse(url).path)
    if '..' in Path(p).parts: raise ValueError('unsafe path')
    if p.startswith('/api/tutorials/') and p.endswith('/code'): return p.lstrip('/')+'.json'
    if p.startswith('/api/tutorials/') and p.endswith('/download'): return p.lstrip('/')+'.html'
    if not Path(p).suffix:
        return p.strip('/')+'/index.html' if p!='/' else 'index.html'
    return p.lstrip('/')

def download(url):
    path=local_path(url); target=DEST/path
    try:
        if target.exists():
            body=target.read_bytes(); content_type='text/html' if path.endswith('.html') else ''
        else:
            with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=45) as r:
                body=r.read(150*1024*1024); content_type=r.headers.get('Content-Type','')
            target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(body)
        return {'path':path,'url':url,'kind':'html' if path.endswith('.html') else Path(path).suffix.lstrip('.'),'status':200,'bytes':len(body)},body,content_type
    except Exception as e:
        return {'path':path,'url':url,'kind':Path(path).suffix.lstrip('.'),'status':'error','bytes':0,'error':str(e)},None,''

def walk_strings(data):
    if isinstance(data,str): yield data
    elif isinstance(data,dict):
        for v in data.values(): yield from walk_strings(v)
    elif isinstance(data,list):
        for v in data: yield from walk_strings(v)

def discover(url, body, ct):
    path=urlparse(url).path
    if not (path.endswith(('.js','.mjs','.css','.json','.html','.xml','.txt')) or 'text/html' in ct or not Path(path).suffix): return []
    text=body.decode('utf-8',errors='replace'); refs=[]
    if 'text/html' in ct or not Path(path).suffix or path.endswith('.html'):
        p=HtmlRefs();p.feed(text);refs+=p.assets
        for raw in p.routes:
            u=canonical(raw,url)
            if u and not EXT.search(u) and len(routes)<ROUTE_CAP:
                routes.add(u);refs.append(u)
            elif u and EXT.search(u): refs.append(u)
    # Use overlapping lookahead so shader strings cannot swallow adjacent literals.
    scan=text
    if path.startswith('/api/'):
        try:
            data=json.loads(text)
            scan='\n'.join(str(v) for v in walk_strings(data))
        except Exception: pass
    for match in re.finditer(r'''(?=["'`]((?:\.?\.?/|images/|videos/|models/|fonts/|fav/|libs/)[^"'`<>\s\\]{1,350})["'`])''',scan):
        raw=match.group(1)
        if EXT.search(raw) and '${' not in raw:
            refs.append('/'+raw if raw.startswith(('images/','videos/','models/','fonts/','fav/','libs/')) else raw)
    refs += re.findall(r'url\(\s*["\']?([^\s\)"\']+)',scan)
    # Runtime-generated texture maps.
    if path.endswith('/index.f180d31c.js'):
        dirs=dict(re.findall(r'(\w+)="(/models/[^"]+)"',text))
        for var,tail in re.findall(r'`\$\{(\w+)\}(/[^`]+\.(?:jpg|png|webp))`',text):
            if var in dirs: refs.append(dirs[var]+tail)
        for icon in re.findall(r'icon:"(icon-48_[^"]+)"',text):
            refs.append('/images/icons/techniques/'+icon+'.svg')
    if path.endswith('/database.92a55625.js'):
        cats=list(re.finditer(r'url:"([a-z-]+)",cases:\[',text))
        for pos,cat in enumerate(cats):
            end=cats[pos+1].start() if pos+1<len(cats) else len(text)
            for slug in re.findall(r'url:"(\d[^"]+)"',text[cat.end():end]):
                route='/skill-hub/'+cat.group(1)+'/'+slug
                routes.add(ORIGIN+route); refs.append(route)
                refs.append('/api/tutorials/'+cat.group(1)+'/'+slug+'/code')
                refs.append('/api/tutorials/'+cat.group(1)+'/'+slug+'/download')
    # Nuxt static paths are useful even if a navigation is only in the runtime.
    if path.endswith(('.js','.mjs')):
        for raw in re.findall(r'path:["\'](/[^"\']*)["\']',text):
            if ':' not in raw and re.fullmatch(r'/[a-z0-9/-]*',raw) and len(routes)<ROUTE_CAP:
                u=canonical(raw,url)
                if u: routes.add(u);refs.append(u)
    result=[]
    for raw in refs:
        u=canonical(raw,url)
        if u and u not in seen: result.append(u)
    return result

DEST.mkdir(parents=True,exist_ok=True)
while pending:
    batch=sorted(pending-seen);pending.clear()
    if not batch:break
    seen.update(batch)
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures={pool.submit(download,u):u for u in batch}
        for f in as_completed(futures):
            url=futures[f]; rec,body,ct=f.result();resources.append(rec)
            if body is not None: pending.update(discover(url,body,ct))
    print(f'{len(resources)} resources, {sum(x["bytes"] for x in resources)/1024/1024:.1f} MiB, {len(pending-seen)} queued',flush=True)
    report={'origin':ORIGIN,'staging':str(DEST),'routes':sorted(routes|{ORIGIN+'/'}),'resources':sorted(resources,key=lambda x:x['path']),'external_urls':sorted(external),'bytes':sum(x['bytes'] for x in resources),'errors':[x for x in resources if x['status']!='200' and x['status']!=200]}
    (DEST/'report.json').write_text(json.dumps(report,indent=2))
print(f'Completed in {time.time()-started:.1f}s; {len(report["errors"])} errors',flush=True)
