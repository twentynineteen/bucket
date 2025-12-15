# UI Audit Report

Generated: {timestamp}

## Executive Summary

- **Total UI files**: {total_count}
- **Reference file**: [{reference_name}]({reference_path})
- **Critical issues**: {critical_count}
- **High priority issues**: {high_count}
- **Medium priority issues**: {medium_count}
- **Low priority issues**: {low_count}

### Quick Stats

| Category     | Count              | Status              |
| ------------ | ------------------ | ------------------- |
| Pages        | {pages_count}      | {pages_status}      |
| Components   | {components_count} | {components_status} |
| Total Issues | {total_issues}     | {issues_status}     |

---

## File Inventory

### Pages ({pages_count})

{pages_list}

### Components ({components_count})

{components_list}

### Root/Entry ({root_count})

{root_list}

---

## Reference Analysis

**File**: [{reference_name}]({reference_path})

### Design System Patterns Extracted

#### Colors

{color_patterns}

**Example**:

- Primary: `bg-blue-500`, `text-blue-600`
- Secondary: `bg-gray-200`, `text-gray-700`
- Accent: `bg-green-500`, `text-green-600`
- Danger: `bg-red-500`, `text-red-600`

#### Typography

{typography_patterns}

**Example**:

- h1: `text-4xl font-bold`
- h2: `text-2xl font-semibold`
- h3: `text-xl font-medium`
- Body: `text-base`
- Small: `text-sm`

#### Spacing

{spacing_patterns}

**Example**:

- Container padding: `p-6`
- Section gaps: `gap-4`
- Button padding: `px-4 py-2`

#### Component Patterns

{component_patterns}

**Example**:

- Primary Button: `bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:ring-2`
- Secondary Button: `bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300`
- Card: `bg-white rounded-lg shadow-md p-6`
- Input: `border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500`

---

## Issues by File

{issues_by_file}

### Template for Each File:

### [{filename}]({filepath})

#### Critical Issues ({count})

1. **{Issue Title}** (Line {line_number})
   - **Issue**: {description}
   - **Impact**: {accessibility_or_ux_impact}
   - **WCAG Violation**: {wcag_criterion} (if applicable)
   - **Fix**:

     ```tsx
     // Before
     {
       before_code
     }

     // After
     {
       after_code
     }
     ```

#### High Priority Issues ({count})

1. **{Issue Title}** (Line {line_number})
   - **Issue**: {description}
   - **Impact**: {consistency_or_hierarchy_impact}
   - **Fix**:

     ```tsx
     // Before
     {
       before_code
     }

     // After
     {
       after_code
     }
     ```

#### Medium Priority Issues ({count})

1. **{Issue Title}** (Line {line_number})
   - **Issue**: {description}
   - **Impact**: {minor_inconsistency}
   - **Fix**:

     ```tsx
     // Before
     {
       before_code
     }

     // After
     {
       after_code
     }
     ```

#### Low Priority Issues ({count})

1. **{Issue Title}** (Line {line_number})
   - **Issue**: {description}
   - **Impact**: {optimization_opportunity}
   - **Fix**:

     ```tsx
     // Before
     {
       before_code
     }

     // After
     {
       after_code
     }
     ```

---

## Implementation Plan

### Phase 1: Critical Fixes (Priority: Immediate)

**Estimated effort**: {effort_estimate}

**Files to fix**:

- [ ] [{filename}]({filepath}) - {issue_count} issues
  - Missing ARIA labels
  - Keyboard navigation problems
  - Color contrast violations

**Impact**: These fixes are required for WCAG 2.1 Level AA compliance and ensure the app is usable by all users, including those with disabilities.

---

### Phase 2: High Priority Fixes (Priority: High)

**Estimated effort**: {effort_estimate}

**Files to fix**:

- [ ] [{filename}]({filepath}) - {issue_count} issues
  - Semantic HTML corrections
  - Heading hierarchy fixes
  - Visual consistency improvements

**Impact**: These fixes improve SEO, accessibility, and ensure consistent user experience across the application.

---

### Phase 3: Medium Priority Fixes (Priority: Medium)

**Estimated effort**: {effort_estimate}

**Files to fix**:

- [ ] [{filename}]({filepath}) - {issue_count} issues
  - Spacing standardization
  - Minor typography adjustments
  - Component pattern alignment

**Impact**: These fixes polish the UI and ensure complete visual consistency.

---

### Phase 4: Low Priority Optimizations (Priority: Low)

**Estimated effort**: {effort_estimate}

**Files to fix**:

- [ ] [{filename}]({filepath}) - {issue_count} issues
  - Class consolidation
  - Minor refinements

**Impact**: These optimizations improve code maintainability but don't affect user experience.

---

## Accessibility Compliance Summary

### WCAG 2.1 Level AA Checklist

| Criterion                           | Status   | Notes   |
| ----------------------------------- | -------- | ------- |
| **1.1.1 Non-text Content**          | {status} | {notes} |
| **1.3.1 Info and Relationships**    | {status} | {notes} |
| **1.4.3 Contrast (Minimum)**        | {status} | {notes} |
| **2.1.1 Keyboard**                  | {status} | {notes} |
| **2.4.1 Bypass Blocks**             | {status} | {notes} |
| **2.4.2 Page Titled**               | {status} | {notes} |
| **2.4.3 Focus Order**               | {status} | {notes} |
| **2.4.4 Link Purpose (In Context)** | {status} | {notes} |
| **2.4.6 Headings and Labels**       | {status} | {notes} |
| **2.4.7 Focus Visible**             | {status} | {notes} |
| **3.1.1 Language of Page**          | {status} | {notes} |
| **3.2.3 Consistent Navigation**     | {status} | {notes} |
| **3.2.4 Consistent Identification** | {status} | {notes} |
| **3.3.1 Error Identification**      | {status} | {notes} |
| **3.3.2 Labels or Instructions**    | {status} | {notes} |
| **4.1.1 Parsing**                   | {status} | {notes} |
| **4.1.2 Name, Role, Value**         | {status} | {notes} |

**Legend**:

- ✅ Pass
- ⚠️ Partial (some issues found)
- ❌ Fail

---

## Visual Consistency Score

| Category               | Score       | Details   |
| ---------------------- | ----------- | --------- |
| **Color Palette**      | {score}/100 | {details} |
| **Typography**         | {score}/100 | {details} |
| **Spacing**            | {score}/100 | {details} |
| **Component Patterns** | {score}/100 | {details} |
| **Overall**            | {score}/100 | {summary} |

---

## Next Steps

### Immediate Actions

1. **Review this report** and approve suggested fixes
2. **Run Phase 1 (Critical)** fixes to achieve WCAG compliance
3. **Validate fixes** with automated testing (via `test-specialist` skill)

### Recommended Follow-up

1. **Run `test-specialist` skill** for automated accessibility testing
2. **Create design system documentation** based on reference patterns
3. **Establish linting rules** to prevent future inconsistencies (ESLint + Stylelint)

### Questions?

- Need clarification on any suggested fix?
- Want to modify the reference patterns?
- Prefer a different implementation approach?

**Let me know and I'll adjust the plan accordingly!**

---

## Appendix

### Tools Used

- File discovery: `Glob` pattern matching
- Code analysis: `mcp__serena__get_symbols_overview`, `Read`
- Accessibility checks: Manual WCAG 2.1 Level AA validation
- Pattern extraction: AST analysis of Tailwind classes

### References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Accessibility](https://react.dev/learn/accessibility)
- [MDN: ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)

---

**Report generated by**: Claude Code UI Analyzer Skill
**Timestamp**: {timestamp}
**Version**: 1.0.0
