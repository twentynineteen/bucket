# Tailwind Audit Methodology

## Overview

This document describes the systematic approach for auditing Tailwind CSS usage in a codebase to identify inconsistencies, detect patterns, and guide refactoring toward a unified theme-based design system.

## Audit Process Phases

### Phase 1: Discovery & Analysis

#### Step 1: Theme Configuration Analysis

**Objective**: Understand the existing theme structure

**Actions**:

1. Read `src/index.css` (or primary CSS file)
2. Extract all `@theme` definitions
3. Identify existing semantic tokens
4. Document dark mode support
5. Note custom animations and utilities

**Look for**:

- Color tokens (HSL format)
- Spacing/sizing variables
- Radius definitions
- Font configurations
- Custom CSS properties

**Output**:

```
Theme Analysis:
- Semantic tokens defined: primary, secondary, destructive, muted, accent, card, border, input, ring
- Dark mode: Yes (via .dark class)
- Missing tokens: warning, info, success
- Custom animations: accordion-down, accordion-up
- Custom radius: --radius (0.5rem) with calculated variants
```

#### Step 2: Codebase Scanning

**Objective**: Identify all Tailwind class usage

**Search Patterns** (regex):

```regex
# Hardcoded utility colors
(bg|text|border|ring)-(red|blue|green|yellow|amber|orange|purple|pink|indigo|gray|slate)-(50|100|200|300|400|500|600|700|800|900)

# Arbitrary values
(w|h|p|m|top|left|right|bottom|gap|space)-\[[0-9]+\.?[0-9]*(px|rem|em|%)\]

# Arbitrary colors
(bg|text|border)-\[#[0-9a-fA-F]{3,6}\]

# Opacity modifiers on utilities
(bg|text)-(red|blue|green|yellow|amber|orange|purple|pink|indigo|gray|slate)-(50|100|200|300|400|500|600|700|800|900)\/[0-9]{1,3}
```

**File Types to Scan**:

- `.tsx`, `.jsx` (React components)
- `.ts`, `.js` (utility files with class generation)
- `.html`, `.vue`, `.svelte` (if applicable)

**Exclude**:

- `node_modules/`
- `.next/`, `dist/`, `build/` (build artifacts)
- `*.test.*`, `*.spec.*` (test files - optional)
- `src/components/ui/*` (shadcn/ui library - usually correct)

#### Step 3: Pattern Analysis

**Objective**: Categorize and quantify issues

**Categorization**:

1. **Hardcoded Interactive Colors**
   - Blue utilities in buttons/links → Should use `primary`
   - Red utilities in destructive actions → Should use `destructive`
   - Gray utilities in secondary actions → Should use `secondary`

2. **Hardcoded Status Colors**
   - Green utilities → Should use `success` token
   - Red utilities in errors → Should use `error`/`destructive`
   - Amber/Orange/Yellow → Should use `warning` token
   - Blue utilities in info messages → Should use `info` token

3. **Hardcoded Neutral Colors**
   - `text-gray-900` → `text-foreground`
   - `text-gray-600`, `text-gray-500` → `text-muted-foreground`
   - `bg-gray-100`, `bg-gray-50` → `bg-muted` or `bg-secondary`
   - `border-gray-300`, `border-gray-200` → `border-border` or `border-input`

4. **Arbitrary Sizing Values**
   - `w-[460px]` → Map to standard scale or keep if truly custom
   - `p-[1.5rem]` → Use `p-6` (standard 1.5rem)
   - `h-[48px]` → Use `h-12` (standard 3rem = 48px)

5. **Arbitrary Colors**
   - `bg-[#ff0000]` → Define proper semantic token
   - `text-[rgb(59,130,246)]` → Use existing or create token

**Frequency Analysis**:

```
Color Usage Frequency:
- bg-blue-500: 23 instances
- bg-blue-600: 18 instances
- text-red-600: 15 instances
- text-gray-600: 87 instances
- bg-gray-100: 42 instances
- text-green-600: 12 instances
- text-amber-600: 8 instances
```

**Pattern Insights**:

- High blue usage suggests need for `info` token (non-primary context)
- Green usage indicates missing `success` token
- Amber usage shows missing `warning` token
- Gray usage may map to existing `muted`/`foreground` tokens

#### Step 4: Context Analysis

**Objective**: Understand the intent behind color usage

For each file with violations, analyze:

1. **Component Purpose**
   - Page component? Custom component? UI utility?
   - Interactive (buttons, links) or display (text, cards)?

2. **Color Intent**
   - Why is this color used here?
   - Is it interactive, status, or decorative?
   - Does it convey semantic meaning?

3. **Consistency Check**
   - Are similar elements styled the same way?
   - Do other files use different colors for same intent?

**Example Analysis**:

```
File: src/pages/auth/Login.tsx
- bg-blue-500 on submit button → PRIMARY action (map to bg-primary)
- text-red-500 on error message → ERROR status (map to text-destructive)
- text-blue-600 on link → LINK/info (map to text-primary)

File: src/components/Baker/TrelloCardItem.tsx
- text-blue-600 on file icon → INFO indicator (map to text-info)
- text-orange-600 on warning icon → WARNING indicator (map to text-warning)
- text-gray-900 on title → PRIMARY text (map to text-foreground)
```

### Phase 2: Gap Identification

#### Identify Missing Tokens

Based on pattern analysis, determine which semantic tokens are missing:

**Common Gaps**:

1. **Status Colors**
   - `--color-warning` (for amber/orange usage)
   - `--color-info` (for blue usage in non-primary context)
   - `--color-success` (for green usage)
   - `--color-error` (if not using destructive for errors)

2. **Neutral Variations**
   - Additional gray shades if current tokens don't cover all uses

3. **Component-Specific**
   - Sidebar colors (if sidebar has distinct theme)
   - Chart colors (for data visualization)
   - Badge/tag colors (for categorical labels)

#### Propose Token Additions

For each missing token:

1. **Choose HSL values**
   - Base on most common usage
   - Ensure sufficient contrast (WCAG AA: 4.5:1)
   - Create foreground pair

2. **Light Mode Values**

   ```css
   --color-warning: 38 92% 50%; /* Amber-ish */
   --color-warning-foreground: 48 96% 89%; /* Light yellow */
   ```

3. **Dark Mode Values**

   ```css
   /* In .dark theme */
   --color-warning: 38 92% 60%; /* Lighter for dark bg */
   --color-warning-foreground: 48 96% 12%; /* Dark for contrast */
   ```

4. **Rationale Documentation**
   ```
   Token: warning
   Purpose: Cautionary messages, non-critical alerts, attention-needed states
   Usage: Alert boxes, warning icons, amber-colored status indicators
   Rationale: Found 23 instances of amber/orange/yellow utilities used for warnings
   ```

### Phase 3: Refactoring Strategy

#### Prioritization

**Sort files by**:

1. **Violation count** (highest first) - maximize impact
2. **File type** (pages before components) - user-facing first
3. **Dependency order** (leaf components before parents) - safer updates

**Priority Tiers**:

- **High**: >15 violations per file
- **Medium**: 5-15 violations per file
- **Low**: <5 violations per file

#### Mapping Rules

Create explicit mapping rules for consistency:

**Interactive Elements**:

```
bg-blue-500, bg-blue-600 (on buttons) → bg-primary
bg-red-500, bg-red-600 (on delete buttons) → bg-destructive
bg-gray-200, bg-gray-300 (on secondary buttons) → bg-secondary
```

**Status Indicators**:

```
text-green-600, bg-green-100 → text-success, bg-success/10
text-red-600, bg-red-100 → text-error, bg-error/10
text-amber-600, bg-yellow-100 → text-warning, bg-warning/10
text-blue-600, bg-blue-100 → text-info, bg-info/10
```

**Text Colors**:

```
text-gray-900, text-black → text-foreground
text-gray-600, text-gray-700 → text-muted-foreground
text-gray-500 → text-muted-foreground/80
text-gray-400 → text-muted-foreground/50
```

**Backgrounds**:

```
bg-white, bg-gray-50 → bg-background or bg-card
bg-gray-100 → bg-muted or bg-secondary
bg-gray-200 → bg-muted/80
```

**Borders**:

```
border-gray-300, border-gray-200 → border-border
border-gray-300 (on inputs) → border-input
```

**Hover States**:

```
hover:bg-blue-600 → hover:bg-primary/90
hover:bg-gray-200 → hover:bg-secondary/80
hover:text-blue-700 → hover:text-primary/90
```

#### Edge Cases

**Context-Dependent Colors**:

Problem: Same color used for different purposes

```tsx
// Both use bg-blue-500, but different contexts
<button className="bg-blue-500">Submit</button>  {/* Primary action */}
<div className="bg-blue-500">Info badge</div>    {/* Info indicator */}
```

Solution: Map based on context

```tsx
<button className="bg-primary">Submit</button>
<div className="bg-info">Info badge</div>
```

**Multi-Shade Patterns**:

Problem: Component uses multiple shades of same color

```tsx
<div className="bg-blue-100 border border-blue-300 text-blue-700">Info message</div>
```

Solution: Use opacity modifiers

```tsx
<div className="bg-info/10 border border-info/30 text-info">Info message</div>
```

**Dynamic Classes**:

Problem: Classes generated programmatically

```tsx
const getStatusColor = status => {
  switch (status) {
    case 'active':
      return 'text-green-600'
    case 'pending':
      return 'text-yellow-600'
    case 'failed':
      return 'text-red-600'
  }
}
```

Solution: Map to semantic tokens

```tsx
const getStatusColor = status => {
  switch (status) {
    case 'active':
      return 'text-success'
    case 'pending':
      return 'text-warning'
    case 'failed':
      return 'text-error'
  }
}
```

**Conditional Classes**:

Problem: Template literal classes

```tsx
<div className={`${isError ? 'text-red-600' : 'text-gray-600'}`}>
```

Solution: Use semantic tokens

```tsx
<div className={`${isError ? 'text-error' : 'text-muted-foreground'}`}>
```

### Phase 4: Verification

#### Pre-Refactoring Checks

Before applying changes:

1. **Git status clean**: Ensure no uncommitted changes
2. **Theme tokens defined**: Verify all target tokens exist
3. **Dark mode tested**: Check theme has dark variants
4. **Backup created**: Copy original file or commit current state

#### Post-Refactoring Validation

After each file:

1. **Syntax check**: Ensure valid className attributes
2. **Visual inspection**: Check in dev mode (light + dark)
3. **Hover states**: Verify interactive elements
4. **Contrast check**: Ensure text remains readable
5. **Responsive check**: Test mobile/tablet views

#### Batch Validation

After completing all files:

1. **Build check**: Ensure project builds without errors
2. **Prettier format**: Run `npm run prettier:fix`
3. **Lint check**: Run `npm run eslint:fix`
4. **Test suite**: Run `npm run test` (user-initiated)
5. **Visual QA**: Browse all affected pages/components

## Reporting Structure

### Executive Summary

```markdown
## Executive Summary

**Audit Date**: 2025-12-08
**Scope**: src/ (103 files)
**Duration**: ~30 minutes scan

**Findings**:

- Files with issues: 47 (45.6%)
- Total violations: 346
- Hardcoded colors: 312 instances
- Arbitrary values: 34 instances

**Top Issues**:

1. Hardcoded blue utilities (87 instances)
2. Gray text colors (134 instances)
3. Red error colors (31 instances)
4. Green success colors (28 instances)
5. Arbitrary sizing (34 instances)

**Recommendations**:

- Add 3 semantic tokens: warning, info, success
- Refactor 47 files in 3 priority tiers
- Estimated effort: 2-4 hours for complete refactoring
```

### File-by-File Breakdown

```markdown
## Detailed Findings

### High Priority Files (>15 violations)

#### src/components/ProjectChangeDetailView.tsx

**Violations**: 24

1. Line 45: `text-green-600` → `text-success`
   Context: Success status indicator for completed changes

2. Line 52: `text-red-600` → `text-error`
   Context: Error status for failed operations

3. Line 67: `bg-blue-100` → `bg-info/10`
   Context: Info card background for change details

4. Line 82: `text-gray-900` → `text-foreground`
   Context: Primary heading text

... (continue for all violations)

**Refactoring Priority**: High (user-facing, high violation count)
**Estimated Time**: 5-10 minutes
```

### Recommended Token Additions

````markdown
## Theme Enhancement Recommendations

### Missing Tokens

#### 1. Warning Token

**Rationale**: 23 instances of amber/orange/yellow utilities for cautionary states

**Proposed Definition**:

```css
@theme {
  --color-warning: 38 92% 50%;
  --color-warning-foreground: 48 96% 89%;
}

.dark {
  @theme {
    --color-warning: 38 92% 60%;
    --color-warning-foreground: 48 96% 12%;
  }
}
```
````

**Usage Examples**:

- Alert messages: "Your session will expire soon"
- Warning icons
- Caution badges

#### 2. Info Token

[Similar structure...]

#### 3. Success Token

[Similar structure...]

````

### Progress Tracking

```markdown
## Refactoring Checklist

### High Priority (>15 violations)
- [ ] src/components/ProjectChangeDetailView.tsx (24 violations)
- [ ] src/pages/auth/Login.tsx (18 violations)
- [ ] src/components/Baker/TrelloCardItem.tsx (12 violations)

### Medium Priority (5-15 violations)
- [ ] src/pages/BuildProject/ProgressBar.tsx (8 violations)
- [ ] src/components/Baker/VideoLinks/AddVideoDialog.tsx (7 violations)
- [ ] src/components/Header.tsx (6 violations)

### Low Priority (<5 violations)
- [ ] src/utils/classNames.ts (3 violations)
- [ ] src/components/Badge.tsx (2 violations)

**Progress**: 0/47 files completed (0%)
````

## Quality Metrics

### Success Criteria

1. **Zero hardcoded colors** in specified scope
2. **All status colors** use semantic tokens
3. **Dark mode compatibility** maintained
4. **No visual regressions** in light/dark modes
5. **Prettier compliance** maintained
6. **Tests passing** (user-verified)

### Metrics to Track

```markdown
## Audit Metrics

**Before Refactoring**:

- Hardcoded utility colors: 312
- Arbitrary values: 34
- Files with violations: 47
- Token coverage: 60%

**After Refactoring**:

- Hardcoded utility colors: 0
- Arbitrary values: 12 (intentional)
- Files with violations: 0
- Token coverage: 100%

**Improvement**: 100% reduction in hardcoded colors
```

## Best Practices

### During Audit

1. **Be thorough**: Don't skip files, even with few violations
2. **Document context**: Note why each color is used
3. **Group similar patterns**: Batch similar violations together
4. **Test continuously**: Check after each file or small batch
5. **Communicate clearly**: Show before/after for user approval

### During Refactoring

1. **One file at a time**: Never batch updates without checkpoints
2. **Understand context first**: Don't blindly replace colors
3. **Test each change**: Verify in browser before moving on
4. **Update incrementally**: Mark checkboxes after each file
5. **Document exceptions**: Note any colors that can't be replaced

### After Completion

1. **Final visual check**: Review all pages in light + dark mode
2. **Document patterns**: Update style guide with new tokens
3. **Share knowledge**: Explain token usage to team
4. **Prevent regression**: Add linting rules if possible
5. **Celebrate success**: Acknowledge improved maintainability

## Tools and Automation

### Regex Patterns for Detection

```bash
# Find hardcoded color utilities
grep -r "(bg|text|border)-(red|blue|green|yellow|amber|orange|purple|indigo|gray)-(50|100|200|300|400|500|600|700|800|900)" src/

# Find arbitrary values
grep -r "\[[0-9]+\.?[0-9]*(px|rem|em|%)\]" src/

# Find arbitrary colors
grep -r "(bg|text|border)-\[#[0-9a-fA-F]{3,6}\]" src/
```

### VS Code Search

```json
// Use VS Code's search with regex enabled
{
  "include": "src/**/*.{tsx,jsx,ts,js}",
  "exclude": "**/node_modules/**,**/dist/**",
  "pattern": "(bg|text|border)-(blue|red|green|gray|amber)-(\\d{2,3})",
  "isRegex": true
}
```

## Appendix

### Color Contrast Requirements

**WCAG AA Standard** (minimum):

- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio

**WCAG AAA Standard** (enhanced):

- Normal text: 7:1 contrast ratio
- Large text: 4.5:1 contrast ratio

### HSL Color Conversion

Common utility colors to HSL:

```
Tailwind Blue-500 (#3b82f6) → HSL(217, 91%, 60%)
Tailwind Red-600 (#dc2626) → HSL(0, 84%, 51%)
Tailwind Green-600 (#16a34a) → HSL(142, 71%, 37%)
Tailwind Amber-600 (#d97706) → HSL(32, 95%, 44%)
Tailwind Gray-900 (#111827) → HSL(222, 47%, 11%)
Tailwind Gray-600 (#4b5563) → HSL(220, 9%, 46%)
```

### Further Reading

- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [HSL Color Model](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl)
- [Tailwind CSS Color Palette](https://tailwindcss.com/docs/customizing-colors)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
