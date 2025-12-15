#!/usr/bin/env python3
"""
Script to systematically replace console statements with logger calls
Part of DEBT-005 Phase 2: Console Statement Replacement
"""

import os
import re
from pathlib import Path
from typing import List, Tuple

# Files to skip
SKIP_FILES = {
    'src/utils/logger.ts',  # The logger implementation itself
    'eslint.config.js',  # ESLint configuration
}

# Patterns to match
CONSOLE_PATTERNS = [
    (r'console\.error\(', 'logger.error('),
    (r'console\.warn\(', 'logger.warn('),
    (r'console\.log\(', 'logger.log('),
    (r'console\.debug\(', 'logger.debug('),
    (r'console\.info\(', 'logger.info('),
]

def should_skip_file(file_path: str) -> bool:
    """Check if file should be skipped"""
    # Skip test files - they test console behavior
    if '/tests/' in file_path or '.test.' in file_path:
        return True

    # Skip scripts and tools
    if '/scripts/' in file_path or '/.claude/' in file_path:
        return True

    # Skip specific files
    for skip in SKIP_FILES:
        if file_path.endswith(skip):
            return True

    return False

def needs_logger_import(content: str) -> bool:
    """Check if file needs logger import"""
    # Check if logger is already imported
    if "from './utils/logger'" in content or 'from "@/utils/logger"' in content or "from './logger'" in content or "from '../logger'" in content:
        return False

    # Check if file has any console statements
    for pattern, _ in CONSOLE_PATTERNS:
        if re.search(pattern, content):
            return True

    return False

def add_logger_import(content: str, file_path: str) -> str:
    """Add logger import to file"""
    # Determine import path based on file location
    if 'src/utils/' in file_path:
        # Files in utils can use relative import
        if file_path.endswith('src/utils/breadcrumbs/debug.ts'):
            import_line = "import { createNamespacedLogger } from '../logger'"
        else:
            import_line = "import { logger } from './logger'"
    else:
        # Use alias import for other files
        import_line = "import { logger } from '@/utils/logger'"

    # Find the last import statement
    lines = content.split('\n')
    last_import_idx = -1

    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or line.strip().startswith('} from'):
            last_import_idx = i

    if last_import_idx == -1:
        # No imports found, add at the beginning
        return f"{import_line}\n\n{content}"

    # Insert after the last import
    lines.insert(last_import_idx + 1, import_line)
    return '\n'.join(lines)

def replace_console_statements(content: str) -> Tuple[str, int]:
    """Replace console statements with logger calls"""
    replacements = 0

    for pattern, replacement in CONSOLE_PATTERNS:
        new_content, count = re.subn(pattern, replacement, content)
        content = new_content
        replacements += count

    return content, replacements

def process_file(file_path: str) -> Tuple[bool, int]:
    """Process a single file"""
    if should_skip_file(file_path):
        return False, 0

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        # Replace console statements
        new_content, replacements = replace_console_statements(original_content)

        if replacements == 0:
            return False, 0

        # Add logger import if needed
        if needs_logger_import(original_content):
            new_content = add_logger_import(new_content, file_path)

        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        return True, replacements

    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False, 0

def find_typescript_files(root_dir: str) -> List[str]:
    """Find all TypeScript/TSX files in src directory"""
    files = []
    src_dir = os.path.join(root_dir, 'src')

    for root, _, filenames in os.walk(src_dir):
        for filename in filenames:
            if filename.endswith(('.ts', '.tsx')) and not filename.endswith('.d.ts'):
                files.append(os.path.join(root, filename))

    return files

def main():
    """Main function"""
    print("🔄 Starting console statement replacement...")
    print("=" * 60)

    root_dir = os.getcwd()
    files = find_typescript_files(root_dir)

    total_files = 0
    total_replacements = 0
    modified_files = []

    for file_path in sorted(files):
        modified, replacements = process_file(file_path)

        if modified:
            total_files += 1
            total_replacements += replacements
            rel_path = os.path.relpath(file_path, root_dir)
            modified_files.append((rel_path, replacements))
            print(f"✅ {rel_path}: {replacements} replacements")

    print("=" * 60)
    print(f"📊 Summary:")
    print(f"   Files modified: {total_files}")
    print(f"   Total replacements: {total_replacements}")
    print(f"\\n✨ Replacement complete!")

    if modified_files:
        print(f"\\n📝 Modified files:")
        for file_path, count in modified_files:
            print(f"   • {file_path} ({count})")

if __name__ == '__main__':
    main()
