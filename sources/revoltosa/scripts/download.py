#!/usr/bin/env python3
"""Repeatable read-only mirror of larevoltosa.es public frontend.
GET only; skips analytics/social/marketing, admin, forms, feed/API discovery.
Keeps remote video refs and caps downloaded assets at 100 MiB (configurable).
"""
import argparse, collections, hashlib, html, json, mimetypes, re, time
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from html.parser import HTMLParser

ORIGIN='https://larevoltosa.es'
THEME=ORIGIN+'/wp-content/themes/larevoltosa'
EXTS=r'(?:css|js|mjs|woff2?|ttf|otf|eot|svg|png|jpe?g|webp|gif|ico|avif|gltf|glb|bin|hdr|json|wasm|ktx2|webmanifest|mp4|webm|mov|pdf)'
ASSET_RE=re.compile(r'''(?:https?:)?//[^\s<>"'`\\]+|(?:/?[A-Za-z0-9_@%+.,:/~-]+\.)'''+EXTS+r'''(?:\?[^\s<>"'`\\]*)?''', re.I)
SKIP=re.compile(r'wp-admin|wp-login|xmlrpc|wp-json|/feed(?:/|$)|comments/feed|google|recaptcha|gtm4wp|duracelltomi|analytics|doubleclick|mailto:|tel:',re.I)
MEDIA={'.mp4','.webm','.mov','.pdf','.zip','.rar','.7z'}

class Mirror:
 def __init__(self,out,limit,max_pages):
  self.out=Path(out); self.out.mkdir(parents=True,exist_ok=True)
  self.limit=limit; self.max_pages=max_pages; self.total=0
  self.prior_records={}
  try:
   prior=json.loads((self.out/'report.json').read_text())
   self.prior_records={x['path']:x for x in prior.get('routes',[])+prior.get('resources',[])}
  except (OSError,ValueError,KeyError):pass
  self.routes=[]; self.resources=[]; self.errors=[]; self.external={}; self.seen=set();self.pending=collections.deque(); self.route_keys=set();self.saved={};self.dynamic=[]
 def canon(self,u,base):
  u=html.unescape(u).replace('\\/','/').strip()
  if not u or u.startswith(('#','data:','blob:','javascript:','mailto:','tel:')):return None
  u=urljoin(base,u); p=urlsplit(u)
  if p.scheme not in ('http','https'):return None
  if p.hostname in ('larevoltosa.es','www.larevoltosa.es'):
   return urlunsplit(('https','larevoltosa.es',p.path or '/',p.query,''))
  return urlunsplit((p.scheme,p.netloc,p.path,p.query,''))
 def add(self,u,base,kind='resource',reason='source'):
  u=self.canon(u,base)
  if not u:return
  if urlsplit(u).hostname!='larevoltosa.es':
   self.external.setdefault(u,{'url':u,'reason':reason});return
  if SKIP.search(u):return
  if '/c-bottle/' in u:
   self.external.setdefault(u,{'url':u,'reason':'unused legacy component, known original 404s'});return
  p=urlsplit(u)
  if Path(p.path).suffix.lower() in MEDIA:
   self.external.setdefault(u,{'url':u,'reason':'large media; retain original public URL'});return
  if kind=='resource' and Path(p.path).suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.avif','.svg','.ico'} and not any(x in reason for x in ('critical','runtime texture','glTF/JSON')) and '/models/' not in p.path:
   self.external.setdefault(u,{'url':u,'reason':'native image or CSS background; retain original public URL'});return
  if kind=='route':
   if p.path.startswith(('/wp-content/','/wp-includes/')):kind='resource'
   elif Path(p.path).suffix and Path(p.path).suffix.lower() not in ('.html','.php'):kind='resource'
   else:
    key=p.path.rstrip('/') or '/'
    if key in self.route_keys:return
    if len(self.route_keys)>=self.max_pages:return
    self.route_keys.add(key)
  if u in self.seen:return
  self.external.pop(u,None)
  self.seen.add(u)
  if kind=='route' or 'runtime texture' in reason or 'glTF/JSON' in reason:self.pending.appendleft((u,kind,reason))
  else:self.pending.append((u,kind,reason))
 def path(self,u,kind):
  p=urlsplit(u); route=unquote(p.path).lstrip('/')
  if any(x=='..' for x in Path(route).parts):raise ValueError('Unsafe path')
  if kind=='route':route=route.rstrip('/')+'/index.html' if route else 'index.html'
  elif not route or route.endswith('/'):route+='index.html'
  # Pure WordPress version query variants deliberately share the physical file.
  q=[x for x in parse_qsl(p.query,keep_blank_values=True) if x[0]!='ver']
  if q:
   x=Path(route);route=str(x.with_name(x.stem+'__q'+hashlib.sha256(urlencode(q).encode()).hexdigest()[:10]+x.suffix))
  return route
 def get(self,u,kind,reason):
  relative=self.path(u,kind);target=self.out/relative
  if target.exists() and relative not in self.saved:
   body=target.read_bytes();self.total+=len(body)
   ctype=mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
   previous=self.prior_records.get(relative,{})
   rec={'url':u,'path':relative,'status':200,'bytes':len(body),'content_type':previous.get('content_type',ctype),'cors':previous.get('cors'),'final_url':previous.get('final_url',u),'reason':reason,'cached':True}
   if not previous or previous.get('headers_note'):rec['headers_note']=previous.get('headers_note','Previously downloaded by GET; original response headers not retained')
   self.saved[relative]=rec;return rec,body
  if relative in self.saved:
   record=dict(self.saved[relative]);record.update(url=u,reason=reason);return record,target.read_bytes()
  for attempt in range(5):
   try:
    req=Request(u,headers={'User-Agent':'Mozilla/5.0 (compatible; PublicFrontendMirror/1.0)','Origin':'https://example.com'})
    with urlopen(req,timeout=45) as r:
     status=r.status;ctype=r.headers.get('Content-Type','');cors=r.headers.get('Access-Control-Allow-Origin');length=int(r.headers.get('Content-Length','0') or 0)
     if self.total+length>self.limit:raise ValueError('100 MiB budget would be exceeded')
     body=r.read(min(25*1024*1024,self.limit-self.total)+1)
     if self.total+len(body)>self.limit:raise ValueError('100 MiB budget would be exceeded')
     if len(body)>25*1024*1024:raise ValueError('Individual resource exceeds 25 MiB; keep original URL')
     final=r.url
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body);self.total+=len(body)
    rec={'url':u,'path':relative,'status':status,'bytes':len(body),'content_type':ctype,'cors':cors,'final_url':final,'reason':reason}
    self.saved[relative]=rec
    return rec,body
   except HTTPError as e:
    if e.code in (429,500,502,503,504) and attempt<4:
     delay=min(int(e.headers.get('Retry-After','0') or 0) or 2**(attempt+1),20);time.sleep(delay);continue
    raise
   except (URLError,TimeoutError) as e:
    if attempt<2:time.sleep(2**(attempt+1));continue
    raise
 def parse(self,u,kind,body,ctype):
  suffix=Path(urlsplit(u).path).suffix.lower()
  if 'text/html' in ctype or kind=='route':
   text=body.decode('utf-8','replace'); Parser(self,u).feed(text)
   for raw in re.findall(r'https?:(?:\\/|/){2}[^\s<>"\'`]+',text):
    if urlsplit(raw.replace('\\/','/')).hostname not in ('larevoltosa.es','www.larevoltosa.es') or re.search(r'\.'+EXTS+r'(?:\?|$)',raw,re.I):self.add(raw,u,reason='inline URL')
   for model in set(re.findall(r'data-bottle-model=["\']([^"\']+)',text)):
    f={'plastico':'PLASTICO_WEB_v3.gltf','sifon':'SIFON_WEB.gltf'}.get(model,model.upper()+'_WEB.gltf')
    self.add(THEME+'/src/bemit/09-components/c-products/models/'+model+'/'+f,u,reason='dynamic product model')
  elif suffix=='.css':
   text=body.decode('utf-8','replace')
   for raw in re.findall(r'url\(\s*["\']?([^\)"\']+)',text):self.add(raw,u,reason='CSS URL')
   for raw in re.findall(r'@import\s+["\']([^"\']+)',text):self.add(raw,u,reason='CSS import')
  elif suffix in ('.gltf','.json','.webmanifest'):
   try:obj=json.loads(body)
   except Exception:return
   def walk(v):
    if isinstance(v,dict):
     for k,x in v.items():
      if k in ('uri','src') and isinstance(x,str):self.add(x,u,reason='glTF/JSON dependency' if suffix=='.gltf' else 'JSON media reference')
      elif isinstance(x,(dict,list)):walk(x)
    elif isinstance(v,list):
     for x in v:walk(x)
   walk(obj)
  elif suffix in ('.js','.mjs') and '/themes/larevoltosa/' in u:
   text=body.decode('utf-8','replace')
   # Literal theme suffixes can be inferred safely from direct concat sites.
   for raw in re.findall(r'''["']((?:/fonts/|/src/bemit/)[^"']+)["']''',text):
    if re.search(r'\.'+EXTS+r'$',raw,re.I):self.add(THEME+raw,u,reason='JS theme literal')
   self.dynamic.append({'url':u,'notes':['window.wa_data.theme_directory controls all animation fetches','product models derived from data-bottle-model; tag textures from data-tag-url','glTF URIs and Draco worker WASM loaded dynamically']})
 def run(self):
  self.add(ORIGIN+'/',ORIGIN,'route')
  # Critical animation dependencies first.
  for x in ['dist/app.js?ver=1786361484','dist/app.css?ver=1786361484','fonts/Teko-Variable/Teko-Variable.json','fonts/Vulf_Mono-Bold/Vulf_Mono_Bold.json','src/bemit/09-components/c-storytelling-v2/models/BOTELLA_VIDRIO_LOWPOLY-version-A.gltf','src/bemit/09-components/c-storytelling-v2/textures/BOTELLA_VIDRIO_512.hdr','src/bemit/09-components/c-storytelling-v2/models/ScratchesLight001_NRM_2K.jpg.jpg','src/bemit/09-components/c-bottle/models/botella_vidrio_centrado.gltf','src/bemit/09-components/c-products/models/bubble.png','src/bemit/09-components/c-products/models/plastico/BOTELLA_NORMAL.png']:
   self.add(THEME+'/'+x,ORIGIN,reason='critical animation seed')
  for x in ['src/bemit/09-components/c-storytelling-v2/models/BOTELLA_VIDRIO_LOWPOLY-version-A.bin','src/bemit/09-components/c-storytelling-v2/models/TAPON_TEXTURA.png','src/bemit/09-components/c-storytelling-v2/models/BOTELLA_CRISTAL_LOWPOLY_textura_version-A.png','src/bemit/09-components/c-products/models/plastico/PLASTICO_WEB_v3.gltf','src/bemit/09-components/c-products/models/sifon/SIFON_WEB.gltf','fonts/Teko-Variable/Teko-Variable.ttf','fonts/GT-America/GT-America-Extended-regular.woff2','fonts/Vulf_Mono-Bold/Vulf_Mono-Bold.woff2']:
   self.add(THEME+'/'+x,ORIGIN,reason='critical animation seed')
  for component in ('c-storytelling-v2',):
   for f in ('draco_wasm_wrapper.js','draco_decoder.wasm','draco_decoder.js'):
    self.add(THEME+'/src/bemit/09-components/'+component+'/draco/'+f,ORIGIN,reason='Draco dynamic decoder')
  while self.pending:
   u,kind,reason=self.pending.popleft()
   try:
    rec,body=self.get(u,kind,reason)
    if kind=='route':
     match=re.search(rb'<link[^>]+rel=[\"\']canonical[\"\'][^>]+href=[\"\']([^\"\']+)',body)
     if match:rec['canonical_url']=html.unescape(match.group(1).decode('utf-8','replace'))
    (self.routes if kind=='route' else self.resources).append(rec)
    self.parse(u,kind,body,rec['content_type'])
    print(kind,rec['bytes'],u,flush=True)
   except KeyboardInterrupt:
    break
   except Exception as e:
    self.errors.append({'url':u,'kind':kind,'error':str(e),'status':getattr(e,'code',None)})
    print('ERROR',u,str(e),flush=True)
   time.sleep(.12)
  report={'origin':ORIGIN,'downloaded_bytes':self.total,'budget_bytes':self.limit,'routes':self.routes,'resources':self.resources,'errors':self.errors,'external_refs':list(self.external.values()),'dynamic_endpoints':self.dynamic,'notes':['GET only; no forms submitted','Version-only resource queries share canonical filesystem path; other queries use deterministic __q SHA256 suffix','Native images, CSS backgrounds, video and PDF URLs inventoried for remote use; no third-party scripts downloaded','Dynamic API references excluded from downloads: wp-json, contact-form-7 feedback, oembed, recaptcha, GTM']}
  enrich_report(report)
  (self.out/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
  print('DONE',len(self.routes),'routes',len(self.resources),'resources',self.total,'bytes',len(self.errors),'errors',flush=True)

def enrich_report(report):
 report['route_bytes']=sum(x['bytes'] for x in report['routes'])
 report['resource_bytes']=sum(x['bytes'] for x in report['resources'])
 report['runtime']={
  'architecture':'WordPress server-rendered HTML; custom larevoltosa theme; one bundled classic app.js; GSAP 3.14.2 + ScrollTrigger/SplitText, Lenis, Swiper, Three.js with GLTFLoader/DRACOLoader/RGBELoader, Vimeo Player',
  'globals':{'wa_data':{'wa_ajax_url':ORIGIN+'/wp-admin/admin-ajax.php','CURRENT_VERSION':'1786361484','theme_directory':THEME}},
  'api_endpoints':[{'url':ORIGIN+'/wp-admin/admin-ajax.php','usage':'wa_data.wa_ajax_url and cookie consent stats; not fetched/submitted'},{'url':ORIGIN+'/wp-json/contact-form-7/v1/contact-forms/861/feedback','usage':'contact form write endpoint; not submitted'},{'url':ORIGIN+'/wp-json/contact-form-7/v1/contact-forms/861/feedback/schema','usage':'form validation schema; not fetched'},{'url':'https://www.google.com/recaptcha/api.js','usage':'third-party recaptcha; not downloaded'},{'url':'https://player.vimeo.com/','usage':'remote video embeds controlled by bundled Vimeo Player; retain embeds remotely'}],
  'mounting_hazards':['Set window.wa_data.theme_directory to the mounted local theme path before loading app.js','Menu hash fallback hardcodes window.location.href="/"+hash; mount at /revoltosa/ requires /revoltosa/+hash','Localize both data-tag-url and data-illustration-url: both feed Three.js TextureLoader, not only native image tags','Both 3D font JSON files must load successfully before hero start()','glTF external URIs must remain adjacent to each glTF file','Product glTF models are uncompressed; c-products Draco decoder URLs return original404s and are unused for these models','Unused legacy c-bottle component paths referenced in app.js return original404s; current homepage uses c-storytelling-v2','Original GT America TTF/WOFF/WOFF2 paths404; valid fallback is GT-America-Extended-Regular.otf','No SPA route mount prefix checks or pathname equality checks found; native navigation links require rewriting'],
  'media_policy':'Keep ordinary native img/srcset, CSS backgrounds, videos/PDF/ZIP downloads at original public URLs. Fonts, glTF/bin/HDR/normal maps, labels/illustration WebGL textures should stay local. Third-party marketing/analytics not downloaded.',
 }
 omit=[x['path'] for x in report['resources'] if x['path'].endswith(('/draco_decoder.js','/Vulf_Mono-Bold.ttf','/Vulf_Mono-Bold.woff'))]
 report['recommended_omit']=omit
 report['recommended_local_bytes']=report['route_bytes']+sum(x['bytes'] for x in report['resources'] if x['path'] not in omit)
 report['recommended_omit_note']='Omit JS Draco fallback for modern WebAssembly-capable browsers; rewrite Vulf CSS to its valid WOFF2 only. Keep Teko TTF and valid GT America OTF. Original other GT fallback files404.'
 return report

class Parser(HTMLParser):
 def __init__(self,mirror,url):super().__init__(convert_charrefs=True);self.mirror=mirror;self.url=url
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a' and a.get('href'):self.mirror.add(a['href'],self.url,'route','internal anchor')
  if tag=='link' and a.get('href') and any(x in a.get('rel','') for x in ('stylesheet','icon','manifest','preload')):self.mirror.add(a['href'],self.url,reason='HTML link')
  for k in ('src','poster','data-src','data-tag-url','data-illustration-url','data-background','data-image'):
   if k in a and tag not in ('iframe',):self.mirror.add(a[k],self.url,reason='runtime texture '+k if k in ('data-tag-url','data-illustration-url') else 'HTML '+k)
  for k in ('srcset','data-srcset'):
   if k in a:
    for part in a[k].split(','):self.mirror.add(part.strip().split(' ')[0],self.url,reason='responsive '+k)
  if 'style' in a:
   for raw in re.findall(r'url\(["\']?([^\)"\']+)',a['style']):self.mirror.add(raw,self.url,reason='inline style')

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--out',default='/private/tmp/revoltosa-original');p.add_argument('--limit-mib',type=int,default=100);p.add_argument('--max-pages',type=int,default=50);args=p.parse_args()
 Mirror(args.out,args.limit_mib*1024*1024,args.max_pages).run()
