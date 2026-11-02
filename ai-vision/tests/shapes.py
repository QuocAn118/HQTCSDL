"""So HINH DANG payload cua AI voi fixture hop dong. Chi kiem kieu, khong thay gia tri (spec 1.5, CLAUDE.md)."""
import json
import re
from pathlib import Path

ISO_Z = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
PLACEHOLDER = re.compile(r'^\{\{(.+)\}\}$')
NOW = re.compile(r'^now(?:[+-]\d+[smh])?$')


def load_fixture(fixtures_dir: Path, name: str) -> dict:
    return json.loads((fixtures_dir / name).read_text(encoding='utf-8'))


def _placeholder_problem(name: str, actual, path: str) -> str | None:
    if NOW.match(name) or name in ('window', 'any:iso'):
        if not (isinstance(actual, str) and ISO_Z.match(actual)):
            return f'{path}: can chuoi UTC co Z, nhan {actual!r}'
        if name == 'window' and not (actual[14:16] in {f'{m:02d}' for m in range(0, 60, 5)} and actual[17:19] == '00'):
            return f'{path}: cua so phai tron 5 phut, nhan {actual}'
        return None
    if name == 'any:id':
        ok = isinstance(actual, int) and not isinstance(actual, bool) and actual > 0
        return None if ok else f'{path}: can so nguyen duong, nhan {actual!r}'
    if name == 'any:string':
        return None if isinstance(actual, str) and actual else f'{path}: can chuoi khong rong, nhan {actual!r}'
    return f'{path}: cho giu cho la {{{{{name}}}}}'


def shape_problems(expected, actual, path: str = '') -> list[str]:
    if isinstance(expected, str):
        m = PLACEHOLDER.match(expected)
        if m:
            p = _placeholder_problem(m.group(1), actual, path)
            return [p] if p else []
        return [] if isinstance(actual, str) else [f'{path}: can chuoi, nhan {type(actual).__name__}']
    if isinstance(expected, bool) or expected is None:
        return [] if type(actual) is type(expected) else [f'{path}: can {type(expected).__name__}, nhan {actual!r}']
    if isinstance(expected, (int, float)):
        ok = isinstance(actual, (int, float)) and not isinstance(actual, bool)
        return [] if ok else [f'{path}: can so, nhan {actual!r}']
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f'{path}: can object, nhan {type(actual).__name__}']
        problems = []
        if set(expected) != set(actual):
            problems.append(f'{path}: khoa khac nhau, thieu {sorted(set(expected) - set(actual))}, thua {sorted(set(actual) - set(expected))}')
        for k in set(expected) & set(actual):
            problems += shape_problems(expected[k], actual[k], f'{path}.{k}')
        return problems
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return [f'{path}: can mang {len(expected)} phan tu, nhan {actual!r}']
        problems = []
        for i, (e, a) in enumerate(zip(expected, actual)):
            problems += shape_problems(e, a, f'{path}[{i}]')
        return problems
    return [f'{path}: kieu fixture khong ho tro {type(expected).__name__}']
