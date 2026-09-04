#!/usr/bin/env python3
"""Apply the E.R.A.S. live-presence + DAI 3.5 website patch.

Usage from the extracted patch directory:
    python APPLY_PATCH.py /path/to/j12h36h.github.io

If no target is supplied, the current directory is used when it looks like the site repo.
The overlay files are copied first, then stale DAI 3.3 page labels are physically swept to 3.5.
"""
from __future__ import annotations
import re
import shutil
import sys
from pathlib import Path

PATCH_ROOT = Path(__file__).resolve().parent
OVERLAY_TOP = {
    'assets', 'account', 'logicalcommunicationservice', 'dai'
}
DAI_TEXT_EXT = {'.html', '.htm', '.js', '.json', '.md', '.txt'}


def looks_like_site(path: Path) -> bool:
    return (path / 'dai').is_dir() and (path / 'game').is_dir() and (path / 'index.html').exists()


def find_target() -> Path:
    if len(sys.argv) > 1:
        target = Path(sys.argv[1]).expanduser().resolve()
        if not looks_like_site(target):
            raise SystemExit(f'Target does not look like the website repository: {target}')
        return target
    cwd = Path.cwd().resolve()
    if looks_like_site(cwd):
        return cwd
    raise SystemExit('Pass the j12h36h.github.io repository folder as the first argument.')


def copy_overlay(target: Path) -> list[str]:
    copied = []
    for top in OVERLAY_TOP:
        source = PATCH_ROOT / top
        if not source.exists():
            continue
        for src in source.rglob('*'):
            if not src.is_file():
                continue
            rel = src.relative_to(PATCH_ROOT)
            dst = target / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            copied.append(str(rel))
    for name in ('firebase.database.rules.json', 'firebase.database.snippet.json'):
        src = PATCH_ROOT / name
        if src.exists():
            shutil.copy2(src, target / name)
            copied.append(name)
    return copied


def sweep_dai_33(target: Path) -> list[str]:
    changed = []
    dai = target / 'dai'
    html_pattern = re.compile(r'3\.3')
    targeted = [
        (re.compile(r'DAI Engine 3\.3'), 'DAI Engine 3.5'),
        (re.compile(r'DAI 3\.3'), 'DAI 3.5'),
        (re.compile(r'\b3\.3 (engine|runtime|condition|action|companion|native|framework|creator)\b', re.I),
         lambda m: f"3.5 {m.group(1)}"),
    ]
    for path in dai.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in DAI_TEXT_EXT:
            continue
        try:
            before = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        after = before
        # HTML is page copy: replace every stale 3.3 display/version mention.
        if path.suffix.lower() in {'.html', '.htm'}:
            after = html_pattern.sub('3.5', after)
        else:
            for pattern, replacement in targeted:
                after = pattern.sub(replacement, after)
        if after != before:
            path.write_text(after, encoding='utf-8')
            changed.append(str(path.relative_to(target)))
    return changed


def main() -> None:
    target = find_target()
    copied = copy_overlay(target)
    changed = sweep_dai_33(target)
    print(f'Patched site: {target}')
    print(f'Overlay files copied: {len(copied)}')
    print(f'DAI files with 3.3 -> 3.5 source cleanup: {len(changed)}')
    if changed:
        for path in changed:
            print(f'  version: {path}')
    print('\nNEXT: enable Firebase Realtime Database and publish firebase.database.rules.json.')
    print('If Firebase gives a non-default database URL, edit assets/js/site-presence-config.js before publishing.')


if __name__ == '__main__':
    main()
