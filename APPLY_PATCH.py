from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
app = root / 'logicalcommunicationservice' / 'assets' / 'js' / 'app.js'
desktop = root / 'logicalcommunicationservice' / 'index.html'
mobile = root / 'lcs-mobile' / 'index.html'

for p in (app, desktop, mobile):
    if not p.exists():
        raise SystemExit(f'Missing expected website file: {p}')

text = app.read_text(encoding='utf-8')
old = """    const dialog=$('#communityProfileDialog');\n    if(dialog?.open)openCommunityProfile(space.id);"""
new = """    const dialog=$('#communityDetailDialog');\n    if(dialog?.open)openCommunityDetail(space.id);"""

if new in text:
    print('app.js: channel-delete dialog refresh is already fixed.')
elif old in text:
    text = text.replace(old, new, 1)
    app.write_text(text, encoding='utf-8')
    print('app.js: fixed channel-delete community-manager refresh.')
else:
    raise SystemExit(
        'Could not find the expected old channel-delete refresh block. '
        'The site source may have changed; patch stopped without guessing.'
    )

CACHE = '20260905-channel-delete1'

def bump(path: Path):
    s = path.read_text(encoding='utf-8')
    import re
    pattern = r'(logicalcommunicationservice/assets/js/app\.js|assets/js/app\.js)\?v=[^\"\']+'
    replacement_count = 0
    def repl(m):
        nonlocal replacement_count
        replacement_count += 1
        return m.group(1) + '?v=' + CACHE
    s2 = re.sub(pattern, repl, s)
    if replacement_count == 0:
        raise SystemExit(f'Could not find app.js cache URL in {path}')
    path.write_text(s2, encoding='utf-8')
    print(f'{path.relative_to(root)}: cache-busted app.js -> {CACHE}')

bump(desktop)
bump(mobile)
print('\nLCS channel delete fix applied successfully.')
print('No Firestore or Realtime Database rule changes are required.')
print('No Cloud Function source change is required for this UI refresh bug.')
