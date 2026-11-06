#!/usr/bin/env python3
"""Explicit maintainer-only snapshot preparation. Never called by build or runtime."""
import concurrent.futures
import hashlib
import html
import json
import re
import subprocess
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'documentation'
CACHE = ROOT / '.downloads'
CACHE.mkdir(parents=True, exist_ok=True)
SOURCES = {
 'go-spec': 'https://go.dev/ref/spec',
 'go-effective': 'https://go.dev/doc/effective_go',
 'go-memory': 'https://go.dev/ref/mem',
 'rust-book': 'https://doc.rust-lang.org/stable/book/print.html',
 'rust-reference': 'https://doc.rust-lang.org/stable/reference/print.html',
 'rust-examples': 'https://doc.rust-lang.org/stable/rust-by-example/print.html',
 'bash-archive': 'https://ftp.gnu.org/gnu/bash/bash-5.3.tar.gz',
 'postgresql': 'https://ftp.postgresql.org/pub/source/v18.6/postgresql-18.6-docs.tar.gz',
 'linux': 'https://www.kernel.org/pub/linux/docs/man-pages/man-pages-6.20.tar.gz',
 'go-license': 'https://raw.githubusercontent.com/golang/go/master/LICENSE',
 'go-content-license': 'https://creativecommons.org/licenses/by/4.0/legalcode.txt',
 'rust-license-mit': 'https://raw.githubusercontent.com/rust-lang/book/main/LICENSE-MIT',
 'rust-license-apache': 'https://raw.githubusercontent.com/rust-lang/book/main/LICENSE-APACHE',
}

def download(item):
 key, url = item
 target = CACHE / key
 if not target.exists():
  with urllib.request.urlopen(url, timeout=60) as response:
   content = response.read(40 * 1024 * 1024 + 1)
  if len(content) > 40 * 1024 * 1024:
   raise ValueError('Download too large: ' + key)
  target.write_bytes(content)
 print(key, target.stat().st_size, flush=True)
 return key, hashlib.sha256(target.read_bytes()).hexdigest()

checksums = dict(concurrent.futures.ThreadPoolExecutor(5).map(download, SOURCES.items()))
print('Downloads ready', flush=True)
# Artifact conversion is completed below; downloaded originals are never executed.
import tempfile
import shutil

entries = []
for directory in ['go', 'rust', 'postgresql', 'bash', 'linux']:
 if (ROOT/directory).exists(): shutil.rmtree(ROOT/directory)
groups = [
 {'id':'go','title':'Go','version':'Snapshot 2026-11-06','license':'Go Authors · BSD-3-Clause / CC BY 4.0'},
 {'id':'rust','title':'Rust','version':'Stable snapshot 2026-11-06','license':'Rust Project Developers · MIT / Apache-2.0'},
 {'id':'postgresql','title':'PostgreSQL','version':'18.6','license':'PostgreSQL Global Development Group · PostgreSQL License'},
 {'id':'bash','title':'Bash','version':'5.3','license':'Free Software Foundation · GFDL-1.3-or-later'},
 {'id':'linux','title':'Linux man-pages','version':'6.20','license':'Linux man-pages authors · per-page licenses (original sources included)'},
]

def save(file, data):
 target = ROOT / file
 target.parent.mkdir(parents=True, exist_ok=True)
 target.write_bytes(data)

def add(group, title, file, source, selector=None):
 entry = {'id':file,'group':group,'title':title,'file':file,'source':source,'format':'html'}
 if selector: entry['selector'] = selector
 entry['sha256']=hashlib.sha256((ROOT/file).read_bytes()).hexdigest()
 entries.append(entry)

for key,title,selector in [
 ('go-spec','The Go Programming Language Specification','article'),
 ('go-effective','Effective Go','article'),('go-memory','The Go Memory Model','article'),
 ('rust-book','The Rust Programming Language','main'),('rust-reference','The Rust Reference','main'),
 ('rust-examples','Rust by Example','main'),('bash','GNU Bash Reference Manual',None),
]:
 group=key.split('-')[0]
 file=group+'/'+key+'.html'
 if key == 'bash':
  with tarfile.open(CACHE/'bash-archive') as archive:
   data=archive.extractfile('bash-5.3/doc/bashref.html').read()
  source='https://www.gnu.org/software/bash/manual/bash.html'
 else:
  data=(CACHE/key).read_bytes();source=SOURCES[key]
 save(file,data);add(group,title,file,source,selector)

with tarfile.open(CACHE/'postgresql') as archive:
 for member in archive.getmembers():
  prefix='postgresql-18.6/doc/src/sgml/html/'
  if not member.isfile() or not member.name.startswith(prefix): continue
  name=member.name[len(prefix):]
  if '/' in name or not name.endswith('.html'): continue
  data=archive.extractfile(member).read()
  title=re.search(rb'<title>(.*?)</title>',data,re.S)
  title=html.unescape(re.sub('<[^>]+>','',title.group(1).decode())) if title else name
  file='postgresql/'+name
  save(file,data);add('postgresql',title,file,'https://www.postgresql.org/docs/18/'+name)
print('PostgreSQL pages:',sum(e['group']=='postgresql' for e in entries),flush=True)

with tempfile.TemporaryDirectory(prefix='myself-man-pages-') as temporary:
 base=Path(temporary)
 pages=[]
 with tarfile.open(CACHE/'linux') as archive:
  prefix='man-pages-6.20/man/'
  for member in archive.getmembers():
   if not member.isfile() or not member.name.startswith(prefix): continue
   name=member.name[len(prefix):]
   if not re.fullmatch(r'man[1-8][a-z]*/[^/]+\.[1-8][a-z]*',name): continue
   target=base/name;target.parent.mkdir(parents=True,exist_ok=True)
   target.write_bytes(archive.extractfile(member).read());pages.append(target)
 def convert(target):
  result=subprocess.run(['mandoc','-Thtml','-O','fragment,man=%N.%S.html',str(target)],cwd=base,capture_output=True,timeout=15)
  if not result.stdout or result.returncode > 3: raise ValueError('Unable to render '+target.name)
  return target,result.stdout
 for target,data in concurrent.futures.ThreadPoolExecutor(4).map(convert,pages):
  name,section=target.name.rsplit('.',1)
  file='linux/'+target.name.replace(':','_')+'.html'
  data=re.sub(rb'href="([^"]+\.html(?:#[^"]*)?)"', lambda match: b'href="'+match.group(1).replace(b':',b'_')+b'"', data)
  save(file,data)
  add('linux',name+'('+section+')',file,'https://man7.org/linux/man-pages/man'+section+'/'+target.name+'.html')
print('Linux pages:',sum(e['group']=='linux' for e in entries),flush=True)
# Preserve the exact original source archive and all per-page copyright/license notices.
save('licenses/linux-man-pages-6.20.tar.gz',(CACHE/'linux').read_bytes())
for key in ['go-license','go-content-license','rust-license-mit','rust-license-apache']:
 save('licenses/'+key+'.txt',(CACHE/key).read_bytes())
entries.sort(key=lambda e:(next(i for i,g in enumerate(groups) if g['id']==e['group']), e['file'].split('/')[-1]!='index.html',e['title'].casefold()))
(ROOT/'catalog.json').write_text(json.dumps({'groups':groups,'entries':entries},ensure_ascii=False,indent=2)+'\n')
(ROOT/'sources.json').write_text(json.dumps({'snapshotDate':'2026-11-06','sources':[{'id':key,'url':url,'sha256':checksums[key]} for key,url in SOURCES.items()]},indent=2)+'\n')
(ROOT/'NOTICE.txt').write_text('''Official documentation snapshot for Myself IDE, prepared 2026-11-06.

The documents retain their original copyrights. This is a local copy, not a translation or a replacement for upstream documentation. URLs and original download SHA-256 values are recorded in sources.json. HTML is stored unchanged except Linux man-pages, which are rendered using mandoc; the complete, unchanged Linux source archive is included under licenses/ with all per-page license notices. The viewer suppresses scripts, forms, styles, images and other active resources. Text, code, tables and headings are retained. No automatic downloads or updates occur in the application.

Go: Copyright The Go Authors; source license BSD-3-Clause, site content CC BY 4.0. Both licenses are included under licenses/.
Rust: Copyright The Rust Project Developers; MIT or Apache-2.0, both included under licenses/.
PostgreSQL: Copyright 1996-2026 The PostgreSQL Global Development Group; see postgresql/legalnotice.html for the complete PostgreSQL License.
Bash: Copyright 1988-2025 Free Software Foundation, Inc.; GNU Free Documentation License 1.3 or later, no invariant sections or cover texts. The complete license is included in bash/bash.html.
Linux man-pages: multiple authors and per-page licenses; see the exact original archive licenses/linux-man-pages-6.20.tar.gz, especially LICENSES/ and source headers.
''')
print('Total documents:',len(entries),flush=True)
