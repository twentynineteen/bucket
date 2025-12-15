# UI Analyzer Skill

## Description

This skill should be used when analyzing and improving the visual consistency, text hierarchy, and accessibility of React/TypeScript UI components. It scans the codebase for all files that render visual interfaces, audits them against WCAG 2.1 Level AA standards, and automatically fixes issues to ensure a unified design system.

Use this skill for:

- Auditing text hierarchy (semantic HTML, visual hierarchy, ARIA labels)
- Ensuring visual theme consistency (colors, spacing, typography, component patterns)
- Validating accessibility compliance (WCAG 2.1 Level AA)
- Creating comprehensive UI audit reports with suggested fixes
- Automatically applying fixes across multiple pages/components
- Integrating with other skills (test-specialist, etc.) for comprehensive quality checks

## Scope

**Project Type**: React/TypeScript applications (including Tauri apps)

**Target Files**: All `.tsx` files that return JSX (pages and components)

## Multi-Phase Workflow

1. **Discovery**: Find all UI files in the codebase
2. **Reference Analysis**: Analyze reference page (user-specified or root component)
3. **Comparison**: Compare other pages/components against reference patterns
4. **Report Generation**: Create markdown report with suggested fixes
5. **Implementation**: Apply fixes automatically with user approval

## Integration

This skill can integrate with:

- `test-specialist`: For automated accessibility testing
- Other custom skills: For coordinated quality improvements

## Output

Generates a markdown audit report with:

- List of all UI files discovered
- Text hierarchy issues and fixes
- Visual theme inconsistencies and fixes
- Accessibility violations and fixes
- Priority levels for each issue
- Multi-phase implementation plan

---

**Location**: managed
**Category**: Frontend Quality & Accessibility
