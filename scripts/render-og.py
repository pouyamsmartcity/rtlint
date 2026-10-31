# Renders docs/og.png (1200x630), the social preview image: python scripts/render-og.py
# English only: Pillow without libraqm cannot shape Persian text.
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
img = Image.new('RGB', (W, H), '#0f0d1a')
d = ImageDraw.Draw(img)
fonts = 'C:/Windows/Fonts/'
bold = ImageFont.truetype(fonts + 'segoeuib.ttf', 112)
sub = ImageFont.truetype(fonts + 'segoeui.ttf', 40)
mono = ImageFont.truetype(fonts + 'consola.ttf', 34)
small = ImageFont.truetype(fonts + 'segoeui.ttf', 30)

# Soft violet glow at the top right.
d.ellipse((760, -260, 1460, 360), fill='#2a1f5c')
d.ellipse((860, -160, 1360, 260), fill='#3a2a85')

d.text((72, 70), 'rt', font=bold, fill='#ecebf5')
d.text((72 + d.textlength('rt', font=bold), 70), 'lint', font=bold, fill='#8b6dff')
d.text((76, 208), 'Find and fix right-to-left (RTL) bugs', font=sub, fill='#ecebf5')
d.text((76, 258), 'and Persian typography in your code', font=sub, fill='#ecebf5')

rows = [
    ('margin-left: 8px', 'margin-inline-start: 8px'),
    ('class="ml-4 text-right"', 'class="ms-4 text-end"'),
    ('<html lang="fa">', '<html lang="fa" dir="rtl">'),
]
y = 350
for before, after in rows:
    d.rounded_rectangle((72, y - 6, W - 72, y + 50), radius=12, fill='#18152a', outline='#2b2745')
    d.text((96, y + 2), before, font=mono, fill='#ff6b93')
    arrow_x = 96 + d.textlength(before, font=mono) + 24
    d.text((arrow_x, y + 2), '→', font=mono, fill='#a29ec0')
    d.text((arrow_x + 56, y + 2), after, font=mono, fill='#4fd1a1')
    y += 72

d.text((76, H - 64), 'Open source · zero dependencies · CLI, ESLint, Stylelint, Vite, MCP', font=small, fill='#a29ec0')
label = 'by Pouyam'
d.text((W - 72 - d.textlength(label, font=small), H - 64), label, font=small, fill='#8b6dff')
img.save('docs/og.png', optimize=True)
print('docs/og.png')
