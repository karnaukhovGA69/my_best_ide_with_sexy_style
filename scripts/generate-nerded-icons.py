#!/usr/bin/env python3
"""Resize the approved artwork into desktop icons using macOS system utilities.

No network, image generation, cropping, recoloring, or profile/product changes.
Run from any directory with: python3 scripts/generate-nerded-icons.py
"""
import hashlib
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/design/nerded-code-icon-approved.png'
EXPECTED = '4be9c1467b4c5cc54d8c09cc6c4b528d7efacbf7a19e7854c10fbb9bd77f066b'


def generate():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED:
        raise ValueError('Approved source hash differs; do not regenerate from a replacement image')
    for tool in ['sips', 'iconutil']:
        if not shutil.which(tool):
            raise RuntimeError('Icon generation requires macOS ' + tool)
    with tempfile.TemporaryDirectory(prefix='nerded-icons-') as temporary:
        work = Path(temporary)
        sizes = [16, 24, 32, 48, 64, 70, 128, 150, 256, 512, 1024]
        images = {}
        for size in sizes:
            output = work / (str(size) + '.png')
            subprocess.run(['sips', '--resampleHeightWidth', str(size), str(size), str(SOURCE), '--out', str(output)], check=True, stdout=subprocess.DEVNULL)
            data = output.read_bytes()
            if data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (size, size):
                raise ValueError('Invalid resized PNG')
            images[size] = data
        iconset = work / 'Nerded.iconset'
        iconset.mkdir()
        for size in [16, 32, 128, 256, 512]:
            (iconset / f'icon_{size}x{size}.png').write_bytes(images[size])
            (iconset / f'icon_{size}x{size}@2x.png').write_bytes(images[size * 2])
        icns = work / 'code.icns'
        subprocess.run(['iconutil', '--convert', 'icns', str(iconset), '--output', str(icns)], check=True)
        # PNG frames are supported by the desktop Windows versions targeted by Electron.
        ico_sizes = [16, 24, 32, 48, 64, 128, 256]
        directory = bytearray(struct.pack('<HHH', 0, 1, len(ico_sizes)))
        offset = 6 + 16 * len(ico_sizes)
        for size in ico_sizes:
            data = images[size]
            directory.extend(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
            offset += len(data)
        ico = bytes(directory) + b''.join(images[size] for size in ico_sizes)
        outputs = {
            'resources/darwin/code.icns': icns.read_bytes(),
            'resources/linux/code.png': images[1024],
            'resources/win32/code.ico': ico,
            'resources/win32/code_70x70.png': images[70],
            'resources/win32/code_150x150.png': images[150],
        }
        for relative, data in outputs.items():
            (ROOT / relative).write_bytes(data)
            print(hashlib.sha256(data).hexdigest(), relative)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED


if __name__ == '__main__':
    generate()
