# UI Analyzer Skill

A comprehensive UI consistency and accessibility analysis skill for React/TypeScript applications.

## What It Does

The UI Analyzer skill performs multi-phase audits of your UI components to ensure:

- ✅ **Text Hierarchy**: Proper semantic HTML, visual hierarchy, and ARIA labels
- ✅ **Visual Consistency**: Unified color palettes, spacing, typography, and component patterns
- ✅ **Accessibility**: WCAG 2.1 Level AA compliance for all users
- ✅ **Automatic Fixes**: Applies corrections with user approval

## When to Use

Invoke this skill when you need to:

- Audit UI consistency across pages and components
- Ensure accessibility compliance (WCAG 2.1 AA)
- Standardize design system patterns
- Fix text hierarchy issues (heading levels, semantic HTML)
- Validate color contrast and keyboard navigation
- Generate comprehensive UI audit reports

## How It Works

### Multi-Phase Workflow

1. **Discovery**: Finds all `.tsx` files that render UI
2. **Reference Analysis**: Establishes baseline patterns from a reference page
3. **Comparison**: Compares all files against reference patterns
4. **Report Generation**: Creates markdown report with suggested fixes
5. **Implementation**: Applies fixes automatically with approval

### Example Usage

```
You: "Analyze and fix UI consistency issues across the app"

Skill:
1. Asks for reference file (or defaults to main workflow page)
2. Discovers 45 UI files (20 pages, 25 components)
3. Analyzes reference patterns (colors, spacing, typography)
4. Finds 12 critical, 28 high, 15 medium issues
5. Generates report at .claude/reports/ui-audit-2025-12-08.md
6. Applies fixes with your approval
```

## Output

The skill generates a comprehensive markdown report including:

- File inventory (pages, components, root files)
- Reference pattern documentation
- Issues grouped by priority (Critical → Low)
- Suggested fixes with before/after code examples
- Multi-phase implementation plan
- WCAG 2.1 Level AA compliance checklist
- Visual consistency scores

Reports are saved to `.claude/reports/ui-audit-{timestamp}.md`

## Integration with Other Skills

### test-specialist

After applying fixes, the skill can invoke `test-specialist` to:

- Run automated accessibility tests
- Validate WCAG compliance
- Generate test coverage reports

### Custom Skills

Coordinates with other skills for comprehensive quality:

- References tailwind-auditor patterns for CSS consistency
- Ensures design system alignment

## What It Checks

### Text Hierarchy

- Semantic HTML elements (`<h1>`, `<h2>`, `<h3>`, etc.)
- Visual hierarchy (consistent Tailwind font classes)
- ARIA labels and roles for accessibility
- Proper heading level progression

### Visual Theme

- Color palette consistency (Tailwind theme colors)
- Spacing patterns (padding, margins, gaps)
- Typography scale (font sizes, weights, line heights)
- Component patterns (buttons, cards, forms)

### Accessibility (WCAG 2.1 Level AA)

- Color contrast ratios (4.5:1 for normal text, 3:1 for large)
- Keyboard navigation (tabIndex, focus states)
- Screen reader support (ARIA, semantic HTML)
- Form accessibility (labels, error messages)

## Priority Levels

Issues are categorized by severity:

- **Critical**: Blocks accessibility, WCAG failures
- **High**: Major inconsistencies, wrong heading levels
- **Medium**: Minor inconsistencies, spacing variations
- **Low**: Optimizations, minor refinements

## Files

- `SKILL.md`: Skill metadata and description
- `instructions.md`: Detailed workflow for Claude
- `report-template.md`: Template for audit reports
- `README.md`: This file (user documentation)

## Requirements

- React/TypeScript codebase
- Tailwind CSS (recommended but not required)
- `.tsx` files for UI components

## Example Fixes

### Before

```tsx
// Non-semantic HTML
<div className="text-2xl font-bold">Dashboard</div>

// Missing ARIA label
<button onClick={handleClose}>×</button>

// Low contrast text
<p className="text-gray-400">Hard to read</p>

// Unlabeled input
<input type="text" placeholder="Name" />
```

### After

```tsx
// Semantic HTML
<h1 className="text-2xl font-bold">Dashboard</h1>

// Accessible button
<button onClick={handleClose} aria-label="Close dialog">×</button>

// Readable text
<p className="text-gray-700">Easy to read</p>

// Labeled input
<label htmlFor="name" className="block mb-2">Name</label>
<input id="name" type="text" placeholder="Name" />
```

## Notes

- Always asks for a reference file before starting analysis
- Applies fixes conservatively (asks before major changes)
- Never breaks existing functionality
- Generates detailed reports for review before implementation
- Can process large codebases efficiently (50+ files)

---

**Version**: 1.0.0
**Created**: 2025-12-08
**Maintained by**: Claude Code Skills
