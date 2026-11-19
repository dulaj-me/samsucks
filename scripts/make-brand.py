"""Kinescope brand assets (DESIGN.md, "Brand mark, wordmark and V1 assets").

Writes the mark and lockup SVGs (wordmark outlined from the app's own font), the hero
mask, and PNG renders: app icons and the splash from design/comps, lockups and wordmarks
from the SVGs. PNGs need Google Chrome; the comps are served by design/serve.mjs.

    python3 -m venv /tmp/brand && /tmp/brand/bin/pip install fonttools brotli uharfbuzz pillow
    /tmp/brand/bin/python scripts/make-brand.py
"""
import io
import os
import subprocess
import tempfile
import time
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image

root = Path(__file__).resolve().parent.parent
brand = root / 'assets' / 'brand'
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
PORT = 8398
LIGHT, DARK = '#F5F3EF', '#151413'
SPLASH_MAX = 176 * 1024

MARK = ('<rect x="2" y="5" width="30" height="21" rx="6" fill="none" stroke="currentColor" stroke-width="3"/>'
        '<path d="M11 31h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
        '<circle cx="17" cy="15.5" r="3.5" fill="currentColor"/>')


def wordmark(size):
    """'kinescope' at 650, width 108%, -0.01em, as one SVG path: (d, width, ascent)."""
    tt = TTFont(root / 'app/fonts/mona-sans-latin-wdth-wght.woff2')
    tt.flavor = None
    buf = io.BytesIO()
    tt.save(buf)
    font = hb.Font(hb.Face(buf.getvalue()))
    font.set_variations({'wght': 650, 'wdth': 108})
    text = hb.Buffer()
    text.add_str('kinescope')
    text.guess_segment_properties()
    hb.shape(font, text)
    upem = tt['head'].unitsPerEm
    scale = size / upem
    track = -0.01 * upem
    pen = SVGPathPen(None)
    x = 0
    infos, positions = text.glyph_infos, text.glyph_positions
    for i, (info, pos) in enumerate(zip(infos, positions)):
        font.draw_glyph_with_pen(info.codepoint, TransformPen(pen, (scale, 0, 0, -scale, (x + pos.x_offset) * scale, 0)))
        x += pos.x_advance + (track if i < len(infos) - 1 else 0)
    return pen.getCommands(), x * scale, tt['hhea'].ascent * scale, tt['hhea'].descent * scale


def lockup_svg(color):
    # Nav size: 34px mark, 12px gap, 32px type centred on the mark like the app's line box.
    d, width, asc, desc = wordmark(32)
    baseline = 1 + (32 - (asc - desc)) / 2 + asc
    w = 34 + 12 + width
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} 34" width="{w:.2f}" height="34" color="{color}">'
            f'{MARK}<path transform="translate(46 {baseline:.2f})" fill="currentColor" d="{d}"/></svg>\n')


def wordmark_svg(color):
    d, width, asc, desc = wordmark(32)
    top = asc * 0.78  # cap and x-height, without the ascender space above
    h = top - desc * 0.3
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-top:.2f} {width:.2f} {h:.2f}" '
            f'width="{width:.2f}" height="{h:.2f}"><path fill="{color}" d="{d}"/></svg>\n')


def hero_mask():
    # The hero dissolve as alpha, at 1/10 scale: clear to 22% from the left, solid from 64%;
    # clear to 34% from the bottom, solid from 76%. The compositor stretches it.
    w, h = 192, 108
    ramp = lambda t, a, b: min(1.0, max(0.0, (t - a) / (b - a)))
    im = Image.new('LA', (w, h))
    px = im.load()
    for y in range(h):
        ay = ramp(1 - (y + 0.5) / h, 0.34, 0.76)
        for x in range(w):
            px[x, y] = (0, round(255 * ramp((x + 0.5) / w, 0.22, 0.64) * ay))
    im.save(root / 'app/img/hero-mask.png', optimize=True)


def shoot(url, w, h, out, transparent=False):
    args = [CHROME, '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
            f'--window-size={w},{h}', '--virtual-time-budget=4000', f'--screenshot={out}']
    if transparent:
        args.append('--default-background-color=00000000')
    subprocess.run(args + [url], check=True, capture_output=True)
    with Image.open(out) as im:
        assert im.size == (w, h), (out, im.size)


def centred(svg, w, h, fill, out):
    """The SVG at fill x the canvas width, centred, on a transparent canvas."""
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as page:
        page.write(f'<!doctype html><style>html,body{{margin:0;width:{w}px;height:{h}px;background:transparent;'
                   f'display:flex;align-items:center;justify-content:center}}svg{{width:{w * fill}px;height:auto}}</style>{svg}')
    shoot('file://' + page.name, w, h, out, transparent=True)
    os.unlink(page.name)


def small_png(src, dest, limit):
    """Palette-quantized when the full-colour file is over the limit."""
    im = Image.open(src).convert('RGB')
    im.save(dest, optimize=True)
    if os.path.getsize(dest) > limit:
        im.quantize(256, dither=Image.Dither.FLOYDSTEINBERG).save(dest, optimize=True)
    print(dest.relative_to(root), os.path.getsize(dest) // 1024, 'KB')


def main():
    brand.mkdir(parents=True, exist_ok=True)
    (brand / 'mark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="34" height="34">{MARK}</svg>\n')
    (brand / 'lockup-light.svg').write_text(lockup_svg(LIGHT))
    (brand / 'lockup-dark.svg').write_text(lockup_svg(DARK))
    hero_mask()

    for name, color in (('light', LIGHT), ('dark', DARK)):
        centred(lockup_svg(color), 1920, 640, 0.72, brand / f'lockup-horizontal-{name}-1920x640.png')
        centred(wordmark_svg(color), 1600, 400, 0.8, brand / f'wordmark-{name}-1600x400.png')

    server = subprocess.Popen(['node', str(root / 'design/serve.mjs')], env=dict(os.environ, PORT=str(PORT)),
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        base = f'http://localhost:{PORT}/comps/'
        icons = root / 'assets/icons'
        for size in (512, 256, 128, 117):
            shoot(base + f'icon.html?size={size}', size, size, icons / f'app-icon-{size}.png')
        for dest in (root / 'app/icon.png', root / 'assets/tizen/icon-dev-117x117.png'):
            dest.write_bytes((icons / 'app-icon-117.png').read_bytes())
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / 'splash.png'
            shoot(base + 'splash.html', 1920, 1080, raw)
            for dest in (root / 'app/img/splash.png', root / 'assets/splash/splash-1920x1080.png'):
                small_png(raw, dest, SPLASH_MAX)
    finally:
        server.terminate()


if __name__ == '__main__':
    main()
