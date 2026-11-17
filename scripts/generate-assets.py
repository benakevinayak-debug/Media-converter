"""Rebuild the original MediaConvert artwork. Requires Pillow; build assets are checked in."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
asset = root / 'build' / 'assets'
asset.mkdir(parents=True, exist_ok=True)
size = 1024
im = Image.new('RGBA', (size, size), (0,0,0,0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((0,0,1023,1023), radius=225, fill='#181320')
d.rounded_rectangle((166,166,858,858), radius=164, fill='#9544cd')
d.line([(413,333),(680,512),(413,691),(413,333)], fill='white',width=45,joint='curve')
im.save(root/'build'/'icon.png')
im.resize((256,256),Image.Resampling.LANCZOS).save(root/'build'/'icon.ico',sizes=[(s,s) for s in [16,24,32,48,64,128,256]])
for name,w,h in [('StoreLogo',50,50),('Square44x44Logo',44,44),('Square150x150Logo',150,150),('Wide310x150Logo',310,150),('Square310x310Logo',310,310),('ListingIcon',300,300)]:
    canvas=Image.new('RGBA',(w,h),'#181320')
    glyph=im.resize((min(w,h),min(w,h)),Image.Resampling.LANCZOS)
    canvas.alpha_composite(glyph,((w-min(w,h))//2,(h-min(w,h))//2))
    canvas.save(asset/(name+'.png'))
im.resize((512,512),Image.Resampling.LANCZOS).save(root/'desktop'/'app-icon.png')
print('Created Windows icon and Store PNG assets.')
