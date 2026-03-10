#!/usr/bin/env python3
"""
Bulk import rewrite script: convert sub-path imports to barrel imports.

Phase 13 Plan 01: Import Convention Alignment
Converts @shared/lib/query-keys -> @shared/lib, @shared/utils/logger -> @shared/utils, etc.
Handles import merging, type-only imports, re-exports, and self-import exclusion.
"""

import os
import re
import sys
from collections import defaultdict
from pathlib import Path

# Map sub-paths to barrel paths
BARREL_MAP = {
    '@shared/utils/logger': '@shared/utils',
    '@shared/utils/storage': '@shared/utils',
    '@shared/utils/breadcrumbs': '@shared/utils',
    '@shared/utils/validation': '@shared/utils',
    '@shared/utils/cn': '@shared/utils',
    '@shared/utils/debounce': '@shared/utils',
    '@shared/utils/versionUtils': '@shared/utils',
    '@shared/lib/query-keys': '@shared/lib',
    '@shared/lib/query-utils': '@shared/lib',
    '@shared/lib/performance-monitor': '@shared/lib',
    '@shared/lib/prefetch-strategies': '@shared/lib',
    '@shared/lib/query-client-config': '@shared/lib',
    '@shared/types/types': '@shared/types',
    '@shared/types/media': '@shared/types',
    '@shared/types/breadcrumbs': '@shared/types',
    '@shared/types/scriptFormatter': '@shared/types',
    '@shared/types/exampleEmbeddings': '@shared/types',
    '@shared/constants/timing': '@shared/constants',
    '@shared/constants/animations': '@shared/constants',
    '@shared/constants/project': '@shared/constants',
}

# Exception paths -- do NOT convert
EXCEPTION_PATHS = [
    '@shared/hooks/useWindowState',
    '@shared/hooks/useMacOSEffects',
    '@shared/hooks/useUpdateManager',
    '@shared/hooks/useSystemTheme',
    '@shared/hooks/useVersionCheck',
]

EXCEPTION_PREFIXES = [
    '@shared/services/ai/',
]

# Directories to skip entirely
SKIP_DIRS = ['__contracts__', 'node_modules', '.git']

# Self-import mapping: files within these dirs should NOT import from their own barrel
# key = barrel target, value = directory prefix (relative to src/)
SELF_IMPORT_SCOPES = {
    '@shared/lib': 'src/shared/lib',
    '@shared/utils': 'src/shared/utils',
    '@shared/types': 'src/shared/types',
    '@shared/constants': 'src/shared/constants',
}

# Previously poisoned barrels (resolved via lazy-loading in query-client-config.ts).
# Kept empty for documentation; remove entirely if desired.
POISONED_BARREL_SCOPES = {}

# Root directory
ROOT = Path(__file__).parent.parent
SRC = ROOT / 'src'

# Stats
stats = {
    'files_modified': 0,
    'imports_rewritten': 0,
    'merges_performed': 0,
    'files_scanned': 0,
}


def should_skip_dir(dirpath):
    """Check if directory should be skipped."""
    parts = Path(dirpath).parts
    return any(skip in parts for skip in SKIP_DIRS)


def is_exception_path(import_path):
    """Check if this import path is a documented exception."""
    if import_path in EXCEPTION_PATHS:
        return True
    for prefix in EXCEPTION_PREFIXES:
        if import_path.startswith(prefix):
            return True
    return False


def is_self_import(filepath, barrel_target):
    """Check if converting this import would create a self-import (importing from own barrel)
    or would pull in a poisoned barrel from within src/shared/."""
    rel_path = str(Path(filepath).relative_to(ROOT))
    scope = SELF_IMPORT_SCOPES.get(barrel_target)
    if scope and rel_path.startswith(scope + '/'):
        return True
    # Check poisoned barrel scopes: shared modules must not use these barrels
    poisoned_scope = POISONED_BARREL_SCOPES.get(barrel_target)
    if poisoned_scope and rel_path.startswith(poisoned_scope):
        return True
    return False


def get_barrel_target(import_path):
    """Get the barrel target for a sub-path import, or None if not in map."""
    return BARREL_MAP.get(import_path)


# Regex to match import/export statements with from clause
# Matches: import { X } from 'path'
#          import type { X } from 'path'
#          export { X } from 'path'
#          export type { X } from 'path'
# Handles multi-line imports
IMPORT_PATTERN = re.compile(
    r'^(\s*)(import|export)\s+(type\s+)?(\{[^}]*\})\s+from\s+[\'"]([^\'"]+)[\'"]',
    re.MULTILINE
)

# For multiline imports that span multiple lines
MULTILINE_IMPORT_START = re.compile(
    r'^(\s*)(import|export)\s+(type\s+)?\{([^}]*)$'
)
MULTILINE_IMPORT_END = re.compile(
    r'^([^}]*)\}\s+from\s+[\'"]([^\'"]+)[\'"]'
)


def process_file(filepath):
    """Process a single file, rewriting sub-path imports to barrel imports."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    lines = content.split('\n')
    new_lines = []
    i = 0
    rewrites = []

    # First pass: collect all imports that need rewriting and group by barrel
    # We need to handle both single-line and multi-line imports
    imports_to_merge = defaultdict(lambda: defaultdict(list))
    # Structure: imports_to_merge[barrel_target][(is_type, keyword)] = [(names, line_indices)]

    processed_lines = set()

    while i < len(lines):
        line = lines[i]

        # Check for single-line import/export
        m = IMPORT_PATTERN.match(line)
        if m:
            indent, keyword, type_prefix, names_block, from_path = m.groups()
            type_prefix = type_prefix.strip() if type_prefix else ''
            barrel = get_barrel_target(from_path)

            if barrel and not is_exception_path(from_path) and not is_self_import(filepath, barrel):
                is_type = bool(type_prefix)
                names = [n.strip() for n in names_block.strip('{}').split(',') if n.strip()]
                key = (is_type, keyword, indent)
                imports_to_merge[barrel][key].append((names, [i]))
                processed_lines.add(i)
                rewrites.append(from_path)
            i += 1
            continue

        # Check for multi-line import start
        ms = MULTILINE_IMPORT_START.match(line)
        if ms:
            indent, keyword, type_prefix, partial_names = ms.groups()
            type_prefix = type_prefix.strip() if type_prefix else ''
            # Collect lines until we find the closing
            collected_names = partial_names
            line_indices = [i]
            j = i + 1
            while j < len(lines):
                me = MULTILINE_IMPORT_END.match(lines[j])
                if me:
                    rest_names, from_path = me.groups()
                    collected_names += ',' + rest_names
                    line_indices.append(j)
                    barrel = get_barrel_target(from_path)
                    if barrel and not is_exception_path(from_path) and not is_self_import(filepath, barrel):
                        is_type = bool(type_prefix)
                        names = [n.strip() for n in collected_names.split(',') if n.strip()]
                        key = (is_type, keyword, indent)
                        imports_to_merge[barrel][key].append((names, line_indices))
                        for li in line_indices:
                            processed_lines.add(li)
                        rewrites.append(from_path)
                    break
                else:
                    collected_names += ',' + lines[j]
                    line_indices.append(j)
                    j += 1
            i = j + 1
            continue

        i += 1

    if not imports_to_merge:
        return False

    # Second pass: generate merged imports
    # For each barrel target, group by (is_type, keyword, indent) and merge names
    merged_imports = {}  # line_index -> replacement line (or None to delete)

    for barrel, key_groups in imports_to_merge.items():
        for (is_type, keyword, indent), entries in key_groups.items():
            all_names = []
            all_line_indices = []
            for names, line_indices in entries:
                all_names.extend(names)
                all_line_indices.extend(line_indices)

            # Deduplicate names while preserving order
            seen = set()
            unique_names = []
            for name in all_names:
                if name not in seen:
                    seen.add(name)
                    unique_names.append(name)

            # Build the merged import line
            type_kw = 'type ' if is_type else ''
            names_str = ', '.join(unique_names)
            merged_line = f"{indent}{keyword} {type_kw}{{ {names_str} }} from '{barrel}'"

            if len(entries) > 1:
                stats['merges_performed'] += 1

            # First line index gets the merged import, rest get deleted
            first_idx = all_line_indices[0]
            merged_imports[first_idx] = merged_line
            for idx in all_line_indices[1:]:
                merged_imports[idx] = None  # mark for deletion

    # Third pass: rebuild file
    new_lines = []
    for i, line in enumerate(lines):
        if i in merged_imports:
            replacement = merged_imports[i]
            if replacement is not None:
                new_lines.append(replacement)
            # else: line deleted (part of a merge)
        elif i in processed_lines:
            # This line was part of a multi-line import that got merged elsewhere
            # Already handled by merged_imports
            pass
        else:
            new_lines.append(line)

    new_content = '\n'.join(new_lines)

    if new_content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        stats['files_modified'] += 1
        stats['imports_rewritten'] += len(rewrites)
        return True

    return False


def scan_directory(dirpath):
    """Recursively scan directory for .ts and .tsx files."""
    for root, dirs, files in os.walk(dirpath):
        # Filter out skip directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for fname in files:
            if fname.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, fname)
                stats['files_scanned'] += 1
                process_file(filepath)


def scan_file(filepath):
    """Scan a single file."""
    if os.path.exists(filepath):
        stats['files_scanned'] += 1
        process_file(filepath)


def main():
    print('=== Bulk Import Rewrite: Sub-path -> Barrel ===')
    print()

    # Scan feature modules
    print('Scanning src/features/ ...')
    scan_directory(SRC / 'features')

    # Scan app-level files
    print('Scanning app-level files ...')
    scan_file(SRC / 'App.tsx')
    scan_file(SRC / 'AppRouter.tsx')
    scan_file(SRC / 'index.tsx')

    # Scan shared (with self-import exclusion built in)
    print('Scanning src/shared/ ...')
    scan_directory(SRC / 'shared')

    print()
    print('=== Results ===')
    print(f'Files scanned:    {stats["files_scanned"]}')
    print(f'Files modified:   {stats["files_modified"]}')
    print(f'Imports rewritten: {stats["imports_rewritten"]}')
    print(f'Merges performed: {stats["merges_performed"]}')
    print()
    print('Done!')


if __name__ == '__main__':
    main()
