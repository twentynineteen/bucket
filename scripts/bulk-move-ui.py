#!/usr/bin/env python3
"""
Bulk move script for Plan 02-03: Move all UI components to src/shared/ui/
Handles file moves and import updates atomically.
"""

import os
import re
import shutil

ROOT = '/Users/danielmills/Documents/CODE/bucket'
SRC = os.path.join(ROOT, 'src')
TESTS = os.path.join(ROOT, 'tests')

# ============================================================
# BATCH 1: UI Primitives (from src/components/ui/ -> src/shared/ui/)
# ============================================================
UI_PRIMITIVES = [
    'accordion.tsx',
    'alert-dialog.tsx',
    'alert.tsx',
    'avatar.tsx',
    'badge.tsx',
    'breadcrumb.tsx',
    'button-variants.ts',
    'button.tsx',
    'card.tsx',
    'checkbox.tsx',
    'collapsible.tsx',
    'dialog.tsx',
    'dropdown-menu.tsx',
    'input.tsx',
    'label.tsx',
    'progress.tsx',
    'select.tsx',
    'separator.tsx',
    'sheet.tsx',
    'skeleton.tsx',
    'sonner.tsx',
    'tabs.tsx',
    'tooltip.tsx',
    'use-sidebar.ts',
]

# ============================================================
# BATCH 2: Sidebar sub-module
# ============================================================
SIDEBAR_FILES = [
    'Sidebar.tsx',
    'SidebarLayout.tsx',
    'SidebarMenu.tsx',
    'SidebarProvider.tsx',
]

# ============================================================
# BATCH 3: Theme coalescing
# ============================================================
THEME_MOVES = {
    'src/constants/themes.ts': 'src/shared/ui/theme/themes.ts',
    'src/utils/themeMapper.ts': 'src/shared/ui/theme/themeMapper.ts',
    'src/utils/themeLoader.ts': 'src/shared/ui/theme/themeLoader.ts',
    'src/hooks/useThemePreview.ts': 'src/shared/ui/theme/useThemePreview.ts',
    'src/components/theme-toggle.tsx': 'src/shared/ui/theme/theme-toggle.tsx',
    'src/types/customTheme.ts': 'src/shared/ui/theme/customTheme.ts',
    'src/components/Settings/ThemeSelector.tsx': 'src/shared/ui/theme/ThemeSelector.tsx',
    'src/components/Settings/ThemeColorSwatch.tsx': 'src/shared/ui/theme/ThemeColorSwatch.tsx',
    'src/components/Settings/ThemeImport.tsx': 'src/shared/ui/theme/ThemeImport.tsx',
}

# ============================================================
# BATCH 4: Layout components
# ============================================================
LAYOUT_FILES = [
    'app-sidebar.tsx',
    'nav-main.tsx',
    'nav-user.tsx',
    'team-switcher.tsx',
    'TitleBar.tsx',
    'ErrorBoundary.tsx',
]

# ============================================================
# BATCH 5: Misplaced React components from utils
# ============================================================
UTILS_COMPONENTS = [
    'ApiKeyInput.tsx',
    'EmbedCodeInput.tsx',
    'ExternalLink.tsx',
    'FormattedDate.tsx',
]


def ensure_dir(path):
    os.makedirs(os.path.join(ROOT, path), exist_ok=True)


def copy_file(src_rel, dst_rel):
    src_abs = os.path.join(ROOT, src_rel)
    dst_abs = os.path.join(ROOT, dst_rel)
    if os.path.exists(src_abs):
        shutil.copy2(src_abs, dst_abs)
        print(f'  COPY: {src_rel} -> {dst_rel}')
        return True
    else:
        print(f'  SKIP (not found): {src_rel}')
        return False


def delete_file(rel_path):
    abs_path = os.path.join(ROOT, rel_path)
    if os.path.exists(abs_path):
        os.remove(abs_path)
        print(f'  DEL: {rel_path}')


# Import replacement rules: (pattern, replacement)
# These are applied to ALL .ts/.tsx files in src/ and tests/
IMPORT_REPLACEMENTS = []


def add_replacement(old_import, new_import):
    """Add an import path replacement rule."""
    IMPORT_REPLACEMENTS.append((old_import, new_import))


# ============================================================
# Build replacement rules
# ============================================================

# Batch 1: UI primitives
# @components/ui/xxx -> @shared/ui/xxx
# @/components/ui/xxx -> @shared/ui/xxx
# Also handle the sidebar barrel: @components/ui/sidebar -> @shared/ui/sidebar (new barrel location)
for f in UI_PRIMITIVES:
    name = f.replace('.tsx', '').replace('.ts', '')
    add_replacement(f"@components/ui/{name}", f"@shared/ui/{name}")
    add_replacement(f"@/components/ui/{name}", f"@shared/ui/{name}")

# Batch 2: Sidebar barrel
# The flat sidebar.tsx barrel will be moved to src/shared/ui/sidebar.tsx
# Consumers import from @components/ui/sidebar -> @shared/ui/sidebar
add_replacement("@components/ui/sidebar'", "@shared/ui/sidebar'")
add_replacement('@components/ui/sidebar"', '@shared/ui/sidebar"')
add_replacement("@/components/ui/sidebar'", "@shared/ui/sidebar'")
add_replacement('@/components/ui/sidebar"', '@shared/ui/sidebar"')

# Batch 3: Theme coalescing
add_replacement("@/components/Settings/ThemeColorSwatch", "@shared/ui/theme/ThemeColorSwatch")
add_replacement("@components/Settings/ThemeColorSwatch", "@shared/ui/theme/ThemeColorSwatch")
add_replacement("@/components/Settings/ThemeSelector", "@shared/ui/theme/ThemeSelector")
add_replacement("@components/Settings/ThemeSelector", "@shared/ui/theme/ThemeSelector")
add_replacement("@/components/Settings/ThemeImport", "@shared/ui/theme/ThemeImport")
add_replacement("@components/Settings/ThemeImport", "@shared/ui/theme/ThemeImport")
add_replacement("@components/theme-toggle", "@shared/ui/theme/theme-toggle")
add_replacement("@/components/theme-toggle", "@shared/ui/theme/theme-toggle")
add_replacement("@/constants/themes", "@shared/ui/theme/themes")
add_replacement("@constants/themes", "@shared/ui/theme/themes")
add_replacement("@/utils/themeMapper", "@shared/ui/theme/themeMapper")
add_replacement("@utils/themeMapper", "@shared/ui/theme/themeMapper")
add_replacement("@/utils/themeLoader", "@shared/ui/theme/themeLoader")
add_replacement("@utils/themeLoader", "@shared/ui/theme/themeLoader")
add_replacement("@/hooks/useThemePreview", "@shared/ui/theme/useThemePreview")
add_replacement("@hooks/useThemePreview", "@shared/ui/theme/useThemePreview")
add_replacement("@/types/customTheme", "@shared/ui/theme/customTheme")
add_replacement("@types/customTheme", "@shared/ui/theme/customTheme")

# Batch 4: Layout components
add_replacement("@components/app-sidebar", "@shared/ui/layout/app-sidebar")
add_replacement("@/components/app-sidebar", "@shared/ui/layout/app-sidebar")
add_replacement("@components/nav-main", "@shared/ui/layout/nav-main")
add_replacement("@/components/nav-main", "@shared/ui/layout/nav-main")
add_replacement("@components/nav-user", "@shared/ui/layout/nav-user")
add_replacement("@/components/nav-user", "@shared/ui/layout/nav-user")
add_replacement("@components/team-switcher", "@shared/ui/layout/team-switcher")
add_replacement("@/components/team-switcher", "@shared/ui/layout/team-switcher")
add_replacement("@components/TitleBar", "@shared/ui/layout/TitleBar")
add_replacement("@/components/TitleBar", "@shared/ui/layout/TitleBar")
add_replacement("@components/ErrorBoundary", "@shared/ui/layout/ErrorBoundary")
add_replacement("@/components/ErrorBoundary", "@shared/ui/layout/ErrorBoundary")

# Batch 5: Misplaced utils components
add_replacement("@utils/ApiKeyInput", "@shared/ui/ApiKeyInput")
add_replacement("@/utils/ApiKeyInput", "@shared/ui/ApiKeyInput")
add_replacement("@utils/EmbedCodeInput", "@shared/ui/EmbedCodeInput")
add_replacement("@/utils/EmbedCodeInput", "@shared/ui/EmbedCodeInput")
add_replacement("@utils/ExternalLink", "@shared/ui/ExternalLink")
add_replacement("@/utils/ExternalLink", "@shared/ui/ExternalLink")
add_replacement("@utils/FormattedDate", "@shared/ui/FormattedDate")
add_replacement("@/utils/FormattedDate", "@shared/ui/FormattedDate")

# Relative import in App.tsx: './components/TitleBar' -> './shared/ui/layout/TitleBar'
# and './components/ErrorBoundary' -> './shared/ui/layout/ErrorBoundary'
add_replacement("./components/TitleBar", "./shared/ui/layout/TitleBar")
add_replacement("./components/ErrorBoundary", "./shared/ui/layout/ErrorBoundary")


def update_imports_in_file(filepath):
    """Apply all import replacement rules to a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (UnicodeDecodeError, PermissionError):
        return False

    original = content
    for old, new in IMPORT_REPLACEMENTS:
        content = content.replace(old, new)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        rel = os.path.relpath(filepath, ROOT)
        print(f'  UPDATED: {rel}')
        return True
    return False


def update_internal_imports_sidebar():
    """Update imports within moved sidebar files to use relative paths."""
    sidebar_dir = os.path.join(ROOT, 'src/shared/ui/sidebar')
    for fname in os.listdir(sidebar_dir):
        fpath = os.path.join(sidebar_dir, fname)
        if not fname.endswith(('.tsx', '.ts')):
            continue
        with open(fpath, 'r') as f:
            content = f.read()
        original = content
        # Internal sidebar files import from @components/ui/xxx -> relative paths
        # They import @components/lib/utils -> stays (that file isn't moved)
        # They import @components/ui/button -> @shared/ui/button (already replaced by global rules)
        # They import ../use-sidebar -> stays relative but now use-sidebar is at ../use-sidebar from sidebar/
        # Actually after moving, use-sidebar.ts is at src/shared/ui/use-sidebar.ts
        # and sidebar files are at src/shared/ui/sidebar/*.tsx
        # So ../use-sidebar is correct relative path - no change needed
        if content != original:
            with open(fpath, 'w') as f:
                f.write(content)
            print(f'  INTERNAL: src/shared/ui/sidebar/{fname}')


def update_internal_imports_theme():
    """Update imports within moved theme files to use relative paths."""
    theme_dir = os.path.join(ROOT, 'src/shared/ui/theme')
    for fname in os.listdir(theme_dir):
        fpath = os.path.join(theme_dir, fname)
        if not fname.endswith(('.tsx', '.ts')):
            continue
        with open(fpath, 'r') as f:
            content = f.read()
        original = content

        # ThemeSelector imports ThemeColorSwatch from @/components/Settings/ThemeColorSwatch
        # -> already handled by global rules -> @shared/ui/theme/ThemeColorSwatch
        # But within theme dir, prefer relative: ./ThemeColorSwatch
        content = content.replace(
            "from '@shared/ui/theme/ThemeColorSwatch'",
            "from './ThemeColorSwatch'"
        )
        content = content.replace(
            "from '@shared/ui/theme/themes'",
            "from './themes'"
        )
        content = content.replace(
            "from '@shared/ui/theme/themeMapper'",
            "from './themeMapper'"
        )
        content = content.replace(
            "from '@shared/ui/theme/themeLoader'",
            "from './themeLoader'"
        )
        content = content.replace(
            "from '@shared/ui/theme/useThemePreview'",
            "from './useThemePreview'"
        )
        content = content.replace(
            "from '@shared/ui/theme/customTheme'",
            "from './customTheme'"
        )

        if content != original:
            with open(fpath, 'w') as f:
                f.write(content)
            print(f'  INTERNAL: src/shared/ui/theme/{fname}')


def update_internal_imports_layout():
    """Update imports within moved layout files."""
    layout_dir = os.path.join(ROOT, 'src/shared/ui/layout')
    for fname in os.listdir(layout_dir):
        fpath = os.path.join(layout_dir, fname)
        if not fname.endswith(('.tsx', '.ts')):
            continue
        with open(fpath, 'r') as f:
            content = f.read()
        original = content

        # app-sidebar imports from @shared/ui/layout/* -> use relative
        content = content.replace(
            "from '@shared/ui/layout/nav-main'",
            "from './nav-main'"
        )
        content = content.replace(
            "from '@shared/ui/layout/nav-user'",
            "from './nav-user'"
        )
        content = content.replace(
            "from '@shared/ui/layout/team-switcher'",
            "from './team-switcher'"
        )
        content = content.replace(
            "from '@shared/ui/layout/theme-toggle'",
            "from '../theme/theme-toggle'"
        )
        # app-sidebar imports from @shared/ui/sidebar -> keep as alias
        # app-sidebar imports UpdateDialog from @components/UpdateDialog -> not moved, stays

        if content != original:
            with open(fpath, 'w') as f:
                f.write(content)
            print(f'  INTERNAL: src/shared/ui/layout/{fname}')


def update_sidebar_barrel():
    """Create new sidebar barrel at src/shared/ui/sidebar.tsx that re-exports from sidebar/."""
    barrel_path = os.path.join(ROOT, 'src/shared/ui/sidebar.tsx')
    content = """// Barrel export file for sidebar components
// Re-exports all sidebar components from their individual files
// to maintain backward compatibility with existing imports

export { SidebarProvider } from './sidebar/SidebarProvider'
export { Sidebar, SidebarTrigger, SidebarRail, SidebarInset } from './sidebar/Sidebar'
export {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
} from './sidebar/SidebarMenu'
export {
  SidebarInput,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent
} from './sidebar/SidebarLayout'

// Re-export useSidebar hook for convenience
export { useSidebar } from './use-sidebar'
"""
    with open(barrel_path, 'w') as f:
        f.write(content)
    print(f'  CREATED: src/shared/ui/sidebar.tsx (barrel)')


def update_constants_index():
    """Update src/constants/index.ts since themes.ts is being moved."""
    idx_path = os.path.join(ROOT, 'src/constants/index.ts')
    if os.path.exists(idx_path):
        # themes.ts is being moved, so update to re-export from new location
        content = """/**
 * Constants Index
 *
 * Central export point for all application constants.
 * Note: Theme constants have moved to @shared/ui/theme/themes
 */

export * from '@shared/ui/theme/themes'
"""
        with open(idx_path, 'w') as f:
            f.write(content)
        print('  UPDATED: src/constants/index.ts (re-export from new location)')


def walk_ts_files(*dirs):
    """Walk directories and yield all .ts/.tsx files."""
    for d in dirs:
        for dirpath, dirnames, filenames in os.walk(d):
            # Skip node_modules, dist, .git
            dirnames[:] = [dn for dn in dirnames if dn not in ('node_modules', 'dist', '.git', 'target')]
            for fname in filenames:
                if fname.endswith(('.ts', '.tsx')) and not fname.endswith('.d.ts'):
                    yield os.path.join(dirpath, fname)


def main():
    print("=== Phase 02-03: Moving UI components to src/shared/ui/ ===\n")

    # Create directories
    print("Creating directories...")
    ensure_dir('src/shared/ui')
    ensure_dir('src/shared/ui/sidebar')
    ensure_dir('src/shared/ui/theme')
    ensure_dir('src/shared/ui/layout')

    # Batch 1: Copy UI primitives
    print("\n--- Batch 1: UI Primitives ---")
    for f in UI_PRIMITIVES:
        copy_file(f'src/components/ui/{f}', f'src/shared/ui/{f}')

    # Batch 2: Copy sidebar files
    print("\n--- Batch 2: Sidebar sub-module ---")
    for f in SIDEBAR_FILES:
        copy_file(f'src/components/ui/sidebar/{f}', f'src/shared/ui/sidebar/{f}')
    # Create new sidebar barrel
    update_sidebar_barrel()

    # Batch 3: Copy theme files
    print("\n--- Batch 3: Theme coalescing ---")
    for src, dst in THEME_MOVES.items():
        copy_file(src, dst)

    # Batch 4: Copy layout files
    print("\n--- Batch 4: Layout components ---")
    for f in LAYOUT_FILES:
        copy_file(f'src/components/{f}', f'src/shared/ui/layout/{f}')

    # Also copy nav-main.test.tsx if needed
    if os.path.exists(os.path.join(ROOT, 'src/components/nav-main.test.tsx')):
        copy_file('src/components/nav-main.test.tsx', 'src/shared/ui/layout/nav-main.test.tsx')

    # Batch 5: Copy misplaced utils components
    print("\n--- Batch 5: Misplaced React components ---")
    for f in UTILS_COMPONENTS:
        copy_file(f'src/utils/{f}', f'src/shared/ui/{f}')

    # Update all imports across codebase
    print("\n--- Updating imports across codebase ---")
    updated_count = 0
    for fpath in walk_ts_files(SRC, TESTS):
        if update_imports_in_file(fpath):
            updated_count += 1

    print(f"\n  Total files with import updates: {updated_count}")

    # Update internal imports within moved files
    print("\n--- Updating internal imports ---")
    update_internal_imports_sidebar()
    update_internal_imports_theme()
    update_internal_imports_layout()

    # Update constants/index.ts
    print("\n--- Updating constants/index.ts ---")
    update_constants_index()

    # Delete old files
    print("\n--- Deleting old source files ---")
    for f in UI_PRIMITIVES:
        delete_file(f'src/components/ui/{f}')
    # Delete old sidebar barrel
    delete_file('src/components/ui/sidebar.tsx')
    # Delete old sidebar directory files
    for f in SIDEBAR_FILES:
        delete_file(f'src/components/ui/sidebar/{f}')
    # Delete old theme files
    for src in THEME_MOVES.keys():
        delete_file(src)
    # Delete old layout files
    for f in LAYOUT_FILES:
        delete_file(f'src/components/{f}')
    if os.path.exists(os.path.join(ROOT, 'src/components/nav-main.test.tsx')):
        delete_file('src/components/nav-main.test.tsx')
    # Delete old utils components
    for f in UTILS_COMPONENTS:
        delete_file(f'src/utils/{f}')

    # Clean up empty directories
    print("\n--- Cleaning up empty directories ---")
    for d in ['src/components/ui/sidebar', 'src/components/ui']:
        dpath = os.path.join(ROOT, d)
        if os.path.exists(dpath) and not os.listdir(dpath):
            os.rmdir(dpath)
            print(f'  RMDIR: {d}')

    print("\n=== Done! ===")
    print(f"Files updated: {updated_count}")


if __name__ == '__main__':
    main()
