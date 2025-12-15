---
name: tailwind-auditor
description: Audit and refactor Tailwind CSS usage for consistent theming across the codebase. Detects hardcoded colors, arbitrary values, and inconsistencies, then guides file-by-file updates with user approval.
---

# Tailwind Auditor Skill

## Overview

The Tailwind Auditor skill helps maintain consistent styling across your codebase by analyzing Tailwind CSS usage, identifying inconsistencies with your theme system, and guiding you through phased refactoring to achieve unified design tokens.

This skill is specifically designed for Tailwind CSS v4 projects that use CSS-based configuration (via `@theme` directive) and semantic design tokens (like shadcn/ui patterns).

## When to Use This Skill

Use this skill when you need to:

- **Audit Tailwind usage** across your entire codebase or specific files/directories
- **Identify inconsistencies** like hardcoded utility colors mixed with semantic tokens
- **Standardize styling** to use a consistent theme-based approach
- **Refactor files systematically** from hardcoded values to semantic design tokens
- **Ensure global theme changes** propagate correctly to all components
- **Document styling patterns** and track refactoring progress

## Core Workflow

The skill operates in four distinct phases to prevent context overflow and maintain user control:

### Phase 1: Initial Audit & Analysis

1. **Determine Scope**
   - Ask user for scan scope: entire codebase (default), specific directory, or file list
   - Common scopes: `src/`, `src/pages/`, `src/components/`, or specific file paths

2. **Analyze Current Theme**
   - Read `src/index.css` to extract existing semantic tokens
   - Identify custom colors, spacing, radius variables
   - Document dark mode support and custom animations
   - Note any existing theme structure

3. **Scan Codebase for Patterns**
   - Search for Tailwind class usage across specified scope
   - Detect patterns:
     - **Hardcoded utility colors**: `bg-blue-500`, `text-red-600`, `border-gray-300`
     - **Arbitrary values**: `w-[234px]`, `p-[1.5rem]`, `text-[#ff0000]`
     - **Inconsistent usage**: Same visual intent using different approaches
     - **Missing semantic tokens**: Common patterns not covered by theme

4. **Generate Audit Report**
   - Create timestamped report: `docs/ui/TAILWIND_AUDIT_[YYYY-MM-DD-HHMMSS].md`
   - Include:
     - Executive summary with statistics
     - File-by-file breakdown showing violations per file
     - Specific violations with line context
     - Checkbox task list for each file needing refactoring
     - Recommended theme token additions

5. **Present Findings**
   - Show summary statistics to user
   - Highlight most common issues
   - Display path to generated report

### Phase 2: Theme Enhancement

1. **Analyze Missing Tokens**
   - Review hardcoded color patterns to identify missing semantic tokens
   - Common gaps:
     - **Warning/Alert**: `text-amber-600`, `text-orange-600`, `bg-yellow-100`
     - **Info**: `text-blue-600`, `bg-blue-100` (when not using primary)
     - **Success**: `text-green-600`, `bg-green-100`
     - **Error** (if not using destructive): `text-red-600`, `bg-red-100`
     - **Neutral states**: Inconsistent grays for disabled/muted elements

2. **Propose Theme Additions**
   - Draft new CSS custom properties for `src/index.css`
   - Use HSL format to match existing pattern
   - Include both light and dark mode values
   - Example:
     ```css
     --color-warning: 38 92% 50%;
     --color-warning-foreground: 48 96% 89%;
     --color-info: 217 91% 60%;
     --color-info-foreground: 222 47% 11%;
     --color-success: 142 71% 45%;
     --color-success-foreground: 144 61% 20%;
     ```

3. **Get User Approval**
   - Show proposed additions with explanation
   - Wait for user confirmation: `[Y/n]`
   - If approved, update `src/index.css` with new tokens
   - If rejected, ask user how they want to handle missing tokens

4. **Update Theme File**
   - Add new tokens to both light and dark theme sections
   - Respect existing formatting and structure
   - Add comments explaining new token purpose if needed

### Phase 3: File-by-File Refactoring

This is the main refactoring phase with checkpoint-based progress.

1. **Prioritize Files**
   - Sort files by violation count (highest first)
   - Or process in directory order for logical grouping
   - User can override order if needed

2. **For Each File**:

   **A. Load File Content**
   - Read the target file
   - Parse Tailwind classes and their context

   **B. Analyze Violations**
   - Identify specific class names to replace
   - Determine appropriate semantic token mapping:
     - **Primary actions**: `bg-blue-600` → `bg-primary`
     - **Destructive actions**: `bg-red-600` → `bg-destructive`
     - **Status indicators**:
       - Success: `text-green-600` → `text-success`
       - Warning: `text-amber-600` → `text-warning`
       - Error: `text-red-600` → `text-destructive`
       - Info: `text-blue-600` → `text-info`
     - **Backgrounds**:
       - `bg-gray-100` → `bg-muted`
       - `bg-gray-50` → `bg-secondary`
     - **Text colors**:
       - `text-gray-900` → `text-foreground`
       - `text-gray-600` → `text-muted-foreground`
       - `text-gray-400` → `text-muted-foreground/50`
     - **Borders**:
       - `border-gray-300` → `border-border`
       - `border-gray-200` → `border-input`

   **C. Generate Preview**
   - Show before/after diff for all changes
   - Highlight changed classes
   - Explain reasoning for each mapping
   - Example:

     ```diff
     - <button className="bg-blue-500 hover:bg-blue-600 text-white">
     + <button className="bg-primary hover:bg-primary/90 text-primary-foreground">

     Rationale: Primary action button should use semantic primary token
     ```

   **D. Get User Approval**
   - Ask: `Apply changes to [filename]? [Y/n/skip]:`
   - Options:
     - `Y` or `y`: Apply changes
     - `n`: Skip this file permanently
     - `skip`: Skip for now, revisit later
     - `edit`: Let user provide custom mapping

   **E. Apply Changes**
   - Use Edit tool to replace classes
   - Preserve existing formatting (Prettier will handle final formatting)
   - Maintain component functionality
   - Don't modify non-Tailwind code

   **F. Update Report Checkpoint**
   - Mark file as completed in audit report: `- [x] filename.tsx`
   - Add timestamp of completion
   - Note any manual follow-up needed

   **G. Save Checkpoint**
   - Report is continuously updated after each file
   - User can stop and resume at any time
   - Progress is never lost

3. **Handle Edge Cases**
   - **Context-dependent colors**: Ask user for clarification
   - **Multi-purpose components**: May need manual review
   - **Complex class combinations**: Show extra explanation
   - **Dynamic classes**: Flag for manual review if template literals involved

### Phase 4: Final Summary

1. **Update Report Statistics**
   - Recalculate totals
   - Mark audit as complete
   - List any remaining manual tasks

2. **Generate Summary**
   - Files refactored: X/Y
   - Classes updated: count
   - Theme tokens added: count
   - Files skipped: list with reasons

3. **Recommend Next Steps**
   - Run Prettier: `npm run prettier:fix`
   - Verify visual output in dev mode: `npm run dev:tauri`
   - Run test suite: `npm run test`
   - Review dark mode appearance
   - Check responsive behavior

4. **Prompt Manual Testing**
   - Don't run tests automatically
   - User should verify functionality manually
   - Provide testing checklist based on changed files

## Mapping Strategy

### Color Mappings

Follow these semantic mappings for consistent theming:

#### Interactive Elements (Buttons, Links, Focus States)

- Primary action: `bg-blue-*` → `bg-primary`
- Secondary action: `bg-gray-*` → `bg-secondary`
- Destructive action: `bg-red-*` → `bg-destructive`
- Hover states: Use `/90` opacity modifier (e.g., `hover:bg-primary/90`)
- Focus states: Use `ring-ring` for focus rings

#### Status/Feedback Colors

- Success: `text-green-*`, `bg-green-*` → `text-success`, `bg-success`
- Warning: `text-amber-*`, `text-orange-*`, `bg-yellow-*` → `text-warning`, `bg-warning`
- Error: `text-red-*`, `bg-red-*` → `text-destructive`, `bg-destructive`
- Info: `text-blue-*`, `bg-blue-*` → `text-info`, `bg-info`

#### Text Colors

- Primary text: `text-gray-900`, `text-black` → `text-foreground`
- Secondary text: `text-gray-600`, `text-gray-500` → `text-muted-foreground`
- Disabled text: `text-gray-400` → `text-muted-foreground/50`
- Link text: `text-blue-600` → `text-primary`

#### Background Colors

- Page background: `bg-white`, `bg-gray-50` → `bg-background`
- Card background: `bg-white`, `bg-gray-100` → `bg-card`
- Muted background: `bg-gray-100`, `bg-gray-200` → `bg-muted`
- Accent background: `bg-blue-50` → `bg-accent`

#### Border Colors

- Default border: `border-gray-300`, `border-gray-200` → `border-border`
- Input border: `border-gray-300` → `border-input`
- Focus border: `border-blue-500` → `border-ring`

### Spacing and Sizing

#### Arbitrary Values

Replace with standard Tailwind scale when possible:

- `w-[460px]` → `w-[28.75rem]` or use closest standard: `w-96` (384px)
- `p-[1.5rem]` → `p-6` (1.5rem standard)
- `h-[48px]` → `h-12` (3rem = 48px)

#### Custom Radius

If project uses custom radius variables (`--radius-sm`, etc.):

- `rounded-[8px]` → `rounded-lg` or use CSS variable directly

### Dark Mode Handling

- Ensure all mapped tokens have dark mode definitions in `src/index.css`
- Test changes in both light and dark modes
- Use opacity modifiers for subtle variations: `bg-primary/10`, `text-foreground/60`

## Best Practices

### Before Starting Audit

1. **Commit current work**: Ensure clean git state
2. **Backup theme file**: Copy `src/index.css` for reference
3. **Review existing tokens**: Understand current theme structure
4. **Define scope clearly**: Audit entire codebase vs. specific areas

### During Refactoring

1. **One file at a time**: Never batch updates, always checkpoint
2. **Verify context**: Understand component purpose before mapping colors
3. **Maintain functionality**: Don't change behavior, only styling approach
4. **Preserve readability**: Keep class names semantic and clear
5. **Document exceptions**: Note any files requiring manual review

### After Refactoring

1. **Visual QA**: Check all affected components in dev mode
2. **Test interactions**: Verify hover, focus, disabled states
3. **Dark mode check**: Ensure dark theme looks correct
4. **Responsive check**: Test mobile/tablet/desktop views
5. **Run test suite**: Ensure no regressions
6. **Update documentation**: Note any new theme tokens or patterns

## Technical Details

### Tailwind v4 Considerations

This skill is designed for Tailwind CSS v4, which uses CSS-based configuration:

- **No `tailwind.config.js`**: Configuration in CSS via `@theme` directive
- **CSS custom properties**: All tokens defined as CSS variables
- **HSL color format**: Colors use HSL for easier manipulation
- **Native CSS features**: Uses modern CSS capabilities

### Pattern Detection

The skill uses these detection strategies:

1. **Regex patterns** for Tailwind utility classes
2. **Context analysis** to determine appropriate semantic token
3. **Frequency analysis** to identify common patterns needing tokens
4. **AST parsing** (if needed) for complex template literal classes

### File Processing

- Uses existing Read/Edit tools for file operations
- Respects `.prettierrc` formatting rules
- Maintains git-friendly diffs (minimal changes)
- Preserves comments and structure

### Report Format

Markdown reports include:

- YAML frontmatter with metadata
- Executive summary section
- Detailed findings per file
- Interactive checklist for tracking
- Recommendations section
- Appendix with reference material

## Error Handling

### Common Issues

**Issue**: Can't determine appropriate semantic token
**Solution**: Flag for manual review, provide options to user

**Issue**: File has dynamic class generation (template literals)
**Solution**: Mark as "Requires manual review" in report

**Issue**: Color used in multiple contexts with different meanings
**Solution**: Ask user for clarification on each context

**Issue**: Theme doesn't have appropriate token for usage pattern
**Solution**: Propose new token in Phase 2

**Issue**: File changed during refactoring process
**Solution**: Detect conflict, ask user to resolve, restart that file

## Example Usage

### Scenario 1: Full Codebase Audit

```
User: I want to audit the entire codebase for Tailwind inconsistencies

Claude: I'll run a comprehensive Tailwind audit of your codebase.

Scan scope: [entire codebase (default) / directory / specific files]:
User: [press enter for default]

[Scanning 103 files across src/...]
[Analyzing src/index.css theme configuration...]

Audit complete! Summary:
- Files scanned: 103
- Files with issues: 47 (45.6%)
- Hardcoded colors found: 312 instances
- Arbitrary values found: 34 instances
- Most common issue: Hardcoded blue utilities (87 instances)

Report generated: docs/ui/TAILWIND_AUDIT_2025-12-08-143022.md

Missing semantic tokens detected:
- Warning/alert colors (amber, orange usage: 23 instances)
- Info colors (blue usage: 87 instances, non-primary context)
- Success colors (green usage: 31 instances)

Would you like me to add these tokens to src/index.css? [Y/n]:
User: Y

[Adding warning, info, success tokens to theme...]
Theme updated successfully.

Ready to begin file refactoring. Start with highest violation files? [Y/n]:
User: Y

File 1/47: src/components/ProjectChangeDetailView.tsx (24 violations)
[Shows diff preview...]
Apply changes? [Y/n/skip]:
User: Y

[Applying changes...]
[Updating report checkpoint...]
File complete: src/components/ProjectChangeDetailView.tsx

File 2/47: src/pages/auth/Login.tsx (18 violations)
...
```

### Scenario 2: Single Directory Audit

```
User: Audit just the Baker component directory

Claude: I'll audit the Baker components for Tailwind inconsistencies.

Scan scope: src/components/Baker

[Scanning 8 files in src/components/Baker/...]

Audit complete! Summary:
- Files scanned: 8
- Files with issues: 5 (62.5%)
- Hardcoded colors: 43 instances
- Most common: Status indicator colors (blue, orange, red)

Report: docs/ui/TAILWIND_AUDIT_BAKER_2025-12-08-143530.md

Missing tokens: Warning colors recommended
Add to theme? [Y/n]:
...
```

### Scenario 3: Single File Refactor

```
User: Refactor TrelloCardItem.tsx to use theme colors

Claude: I'll audit and refactor src/components/Baker/TrelloCardItem.tsx

[Analyzing file...]

Found 12 violations:
- text-blue-600 (3 instances) → text-info
- text-orange-600 (2 instances) → text-warning
- text-red-600 (1 instance) → text-destructive
- text-gray-900 (4 instances) → text-foreground
- text-gray-500 (2 instances) → text-muted-foreground

[Shows full diff...]

Apply changes? [Y/n]:
User: Y

[Applying changes...]
Refactor complete: src/components/Baker/TrelloCardItem.tsx
```

## Integration with Codebase

### Bucket Project Specifics

This skill is tailored for the Bucket project's stack:

- **Tailwind v4**: CSS-based configuration via `@theme`
- **shadcn/ui tokens**: Primary, secondary, destructive, muted, accent, etc.
- **HSL color format**: All colors in HSL for easy manipulation
- **Dark mode**: Full dark theme support via custom variant
- **Prettier**: Respects existing formatting rules (90 char width, single quotes)

### Respecting Project Conventions

- **Component files**: PascalCase naming preserved
- **Import structure**: Doesn't modify imports
- **Comments**: Preserves existing code comments
- **Type annotations**: Maintains TypeScript types
- **Props**: Doesn't change component interfaces
- **Logic**: Only modifies className strings

### Working with Existing UI Library

The project uses shadcn/ui components in `src/components/ui/`:

- These already use semantic tokens correctly
- Focus audit on pages and custom components
- Use UI components as reference for correct patterns

## Progress Tracking

### Report Structure

```markdown
---
audit_date: 2025-12-08T14:30:22Z
scope: src/
total_files: 103
files_with_issues: 47
status: in_progress
---

# Tailwind CSS Audit Report

## Executive Summary

...

## Files Requiring Refactoring

### High Priority (>15 violations)

- [ ] src/components/ProjectChangeDetailView.tsx (24 violations)
- [ ] src/pages/auth/Login.tsx (18 violations)
- [ ] src/components/Baker/TrelloCardItem.tsx (12 violations)

### Medium Priority (5-15 violations)

- [ ] src/pages/BuildProject/ProgressBar.tsx (8 violations)
- [ ] src/components/Baker/VideoLinks/AddVideoDialog.tsx (7 violations)
      ...

### Low Priority (<5 violations)

- [ ] src/components/Header.tsx (3 violations)
      ...

## Detailed Findings

...
```

### Checkpoint Updates

After each file is refactored:

```markdown
- [x] src/components/ProjectChangeDetailView.tsx (24 violations) - Completed 2025-12-08 14:35
- [x] src/pages/auth/Login.tsx (18 violations) - Completed 2025-12-08 14:42
- [ ] src/components/Baker/TrelloCardItem.tsx (12 violations)
```

## Limitations

### What This Skill Does NOT Do

- **Doesn't redesign**: Only maps existing colors to tokens, doesn't change design
- **Doesn't refactor structure**: Only updates className attributes
- **Doesn't handle complex logic**: Flags dynamic classes for manual review
- **Doesn't run tests**: User must verify functionality manually
- **Doesn't modify UI library**: Leaves shadcn/ui components unchanged
- **Doesn't change behavior**: Only updates styling approach, not functionality

### Manual Review Required For

- Template literal classes with dynamic values
- Classes generated by functions or utilities
- Complex conditional class logic
- Third-party component styling
- CSS modules or styled-components (if any)

## Future Enhancements

Potential additions for future versions:

- Auto-detect context from component purpose (button vs. status indicator)
- Generate visual diff screenshots before/after
- Integration with design tokens from Figma
- Batch approval for similar changes
- Rollback capability for completed files
- A/B comparison mode in dev server

## Support

If you encounter issues:

1. Check the generated audit report for specific errors
2. Review the error handling section above
3. Ensure your theme file (src/index.css) is valid
4. Verify Tailwind v4 is properly configured
5. Ask Claude for clarification on specific mappings

Remember: You maintain full control. Approve each change individually, skip files as needed, and stop/resume at any time.
