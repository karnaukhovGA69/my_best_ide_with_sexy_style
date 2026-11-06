"""Offline man-page conversion with paths portable across case-insensitive filesystems."""
import concurrent.futures
import hashlib
import re
import subprocess
import tarfile
import tempfile
from collections import Counter
from pathlib import Path


def render_manpages(archive_path, output_root):
    with tarfile.open(archive_path) as archive:
        prefix = 'man-pages-6.20/man/'
        sources = {
            member.name[len(prefix):]: archive.extractfile(member).read()
            for member in archive.getmembers()
            if member.isfile() and member.name.startswith(prefix)
            and re.fullmatch(r'man[1-8][a-z]*/[^/]+\.[1-8][a-z]*', member.name[len(prefix):])
        }
    sanitized = {name: name.replace(':', '_') for name in sources}
    counts = Counter(name.casefold() for name in sanitized.values())
    names = {}
    for original, safe in sanitized.items():
        stem, section = safe.rsplit('.', 1)
        suffix = '-' + hashlib.sha256(original.encode()).hexdigest()[:12] if counts[safe.casefold()] > 1 else ''
        names[original] = stem + suffix + '.' + section
    if len({name.casefold() for name in names.values()}) != len(names):
        raise ValueError('Man-page filename collision')
    links = {Path(original).name + '.html': Path(safe).name + '.html' for original, safe in names.items()}
    output_root = Path(output_root)
    output_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='myself-man-pages-') as temporary:
        base = Path(temporary)
        for original, data in sources.items():
            # roff aliases must use the same portable paths as extracted source files.
            data = re.sub(rb'(?m)^([.\x27]so\s+)(\S+)', lambda match: match[1] + names.get(match[2].decode(), match[2].decode()).encode(), data)
            target = base / names[original]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)

        def convert(original):
            result = subprocess.run(['mandoc', '-Thtml', '-O', 'fragment,man=%N.%S.html', names[original]], cwd=base, capture_output=True, timeout=15)
            if not result.stdout or result.returncode > 3:
                raise ValueError('Unable to render ' + original)
            def local_link(match):
                href = match[1].decode()
                page, separator, fragment = href.partition('#')
                return b'href="' + (links.get(page, page) + separator + fragment).encode() + b'"'
            data = re.sub(rb'href="([^"]+\.html(?:#[^"]*)?)"', local_link, result.stdout)
            file = links[Path(original).name + '.html']
            (output_root / file).write_bytes(data)
            name, section = Path(original).name.rsplit('.', 1)
            return {'id': 'linux/' + Path(original).name.replace(':', '_') + '.html', 'group': 'linux',
                    'title': name + '(' + section + ')', 'file': 'linux/' + file,
                    'source': 'https://man7.org/linux/man-pages/man' + section + '/' + Path(original).name + '.html',
                    'format': 'html', 'sha256': hashlib.sha256(data).hexdigest()}
        return list(concurrent.futures.ThreadPoolExecutor(4).map(convert, sources))
