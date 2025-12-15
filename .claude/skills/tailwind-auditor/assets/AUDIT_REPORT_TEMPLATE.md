---
audit_date: { { TIMESTAMP } }
scope: { { SCOPE } }
total_files_scanned: { { TOTAL_FILES } }
files_with_issues: { { FILES_WITH_ISSUES } }
total_violations: { { TOTAL_VIOLATIONS } }
status: { { STATUS } }
---

# Tailwind CSS Audit Report

**Generated**: {{TIMESTAMP}}
**Scope**: {{SCOPE}}
**Status**: {{STATUS}}

---

## Executive Summary

### Statistics

- **Files Scanned**: {{TOTAL_FILES}}
- **Files with Issues**: {{FILES_WITH_ISSUES}} ({{PERCENTAGE}}%)
- **Total Violations**: {{TOTAL_VIOLATIONS}}
  - Hardcoded colors: {{HARDCODED_COLORS}}
  - Arbitrary values: {{ARBITRARY_VALUES}}
  - Other issues: {{OTHER_ISSUES}}

### Top Issues

1. {{TOP_ISSUE_1}}
2. {{TOP_ISSUE_2}}
3. {{TOP_ISSUE_3}}
4. {{TOP_ISSUE_4}}
5. {{TOP_ISSUE_5}}

### Theme Analysis

**Existing Semantic Tokens**:
{{EXISTING_TOKENS}}

**Missing Semantic Tokens**:
{{MISSING_TOKENS}}

**Recommendations**:
{{RECOMMENDATIONS}}

---

## Theme Enhancement Recommendations

### Proposed Token Additions

{{#each PROPOSED_TOKENS}}

#### {{name}}

**Rationale**: {{rationale}}

**Proposed Definition**:

```css
@theme {
  --color-{{name}}: {{light_value}};
  --color-{{name}}-foreground: {{light_foreground}};
}

.dark {
  @theme {
    --color-{{name}}: {{dark_value}};
    --color-{{name}}-foreground: {{dark_foreground}};
  }
}
```

**Usage Examples**:
{{#each examples}}

- {{this}}
  {{/each}}

**Instances Found**: {{count}}

---

{{/each}}

## Files Requiring Refactoring

### High Priority (>15 violations)

{{#each HIGH_PRIORITY_FILES}}

- [ ] [{{file_path}}]({{file_path}}) ({{violation_count}} violations)
      {{/each}}

### Medium Priority (5-15 violations)

{{#each MEDIUM_PRIORITY_FILES}}

- [ ] [{{file_path}}]({{file_path}}) ({{violation_count}} violations)
      {{/each}}

### Low Priority (<5 violations)

{{#each LOW_PRIORITY_FILES}}

- [ ] [{{file_path}}]({{file_path}}) ({{violation_count}} violations)
      {{/each}}

---

## Detailed Findings

{{#each FILES_WITH_VIOLATIONS}}

### {{file_path}}

**Priority**: {{priority}}
**Violations**: {{violation_count}}
**Last Modified**: {{last_modified}}

#### Violations

{{#each violations}}
{{index}}. **Line {{line_number}}**: `{{old_class}}` → `{{new_class}}`

- **Context**: {{context}}
- **Rationale**: {{rationale}}
- **Type**: {{violation_type}}

{{/each}}

**Refactoring Notes**:
{{refactoring_notes}}

---

{{/each}}

## Color Usage Analysis

### Hardcoded Color Frequency

| Color Utility | Count | Recommended Token | Context |
| ------------- | ----- | ----------------- | ------- |

{{#each COLOR_FREQUENCY}}
| `{{utility}}` | {{count}} | `{{recommended}}` | {{context}} |
{{/each}}

### Arbitrary Value Frequency

| Arbitrary Value | Count | Standard Alternative | Keep? |
| --------------- | ----- | -------------------- | ----- |

{{#each ARBITRARY_FREQUENCY}}
| `{{value}}` | {{count}} | `{{alternative}}` | {{keep}} |
{{/each}}

---

## Migration Mapping

### Color Mappings

#### Interactive Elements (Buttons, Links)

| Current Class       | New Class             | Context                         |
| ------------------- | --------------------- | ------------------------------- |
| `bg-blue-500`       | `bg-primary`          | Primary action buttons          |
| `bg-blue-600`       | `bg-primary`          | Primary action buttons (darker) |
| `hover:bg-blue-600` | `hover:bg-primary/90` | Primary hover state             |
| `bg-red-600`        | `bg-destructive`      | Delete/remove buttons           |
| `bg-gray-200`       | `bg-secondary`        | Secondary actions               |

#### Status Indicators

| Current Class    | New Class                         | Context             |
| ---------------- | --------------------------------- | ------------------- |
| `text-green-600` | `text-success`                    | Success messages    |
| `bg-green-100`   | `bg-success/10`                   | Success backgrounds |
| `text-red-600`   | `text-error` / `text-destructive` | Error messages      |
| `bg-red-100`     | `bg-error/10`                     | Error backgrounds   |
| `text-amber-600` | `text-warning`                    | Warning messages    |
| `bg-yellow-100`  | `bg-warning/10`                   | Warning backgrounds |
| `text-blue-600`  | `text-info`                       | Info messages       |
| `bg-blue-100`    | `bg-info/10`                      | Info backgrounds    |

#### Text Colors

| Current Class   | New Class                  | Context        |
| --------------- | -------------------------- | -------------- |
| `text-gray-900` | `text-foreground`          | Primary text   |
| `text-black`    | `text-foreground`          | Primary text   |
| `text-gray-600` | `text-muted-foreground`    | Secondary text |
| `text-gray-500` | `text-muted-foreground/80` | Tertiary text  |
| `text-gray-400` | `text-muted-foreground/50` | Disabled text  |

#### Background Colors

| Current Class | New Class                        | Context               |
| ------------- | -------------------------------- | --------------------- |
| `bg-white`    | `bg-background` / `bg-card`      | Page/card backgrounds |
| `bg-gray-50`  | `bg-background` / `bg-secondary` | Light backgrounds     |
| `bg-gray-100` | `bg-muted`                       | Subtle backgrounds    |
| `bg-gray-200` | `bg-muted/80`                    | Slightly darker muted |

#### Border Colors

| Current Class     | New Class       | Context         |
| ----------------- | --------------- | --------------- |
| `border-gray-300` | `border-border` | Default borders |
| `border-gray-200` | `border-input`  | Input borders   |
| `border-blue-500` | `border-ring`   | Focus borders   |

---

## Progress Tracking

### Overall Progress

- [ ] **Phase 1**: Initial audit completed
- [ ] **Phase 2**: Theme tokens added
- [ ] **Phase 3**: File refactoring in progress
- [ ] **Phase 4**: Final verification

### Refactoring Progress

**Total**: {{COMPLETED_FILES}}/{{TOTAL_FILES_WITH_ISSUES}} files completed ({{PROGRESS_PERCENTAGE}}%)

**Last Updated**: {{LAST_UPDATE}}

### Completed Files

{{#each COMPLETED_FILES}}

- [x] [{{file_path}}]({{file_path}}) ({{violation_count}} violations) - Completed {{completion_time}}
      {{/each}}

### Pending Files

{{#each PENDING_FILES}}

- [ ] [{{file_path}}]({{file_path}}) ({{violation_count}} violations)
      {{/each}}

### Skipped Files

{{#each SKIPPED_FILES}}

- [~] [{{file_path}}]({{file_path}}) ({{violation_count}} violations) - Skipped: {{skip_reason}}
  {{/each}}

---

## Validation Checklist

### Pre-Refactoring

- [ ] Git status is clean
- [ ] All proposed theme tokens are defined
- [ ] Dark mode variants are defined
- [ ] Backup of `src/index.css` created

### Post-Refactoring

- [ ] All files refactored successfully
- [ ] Prettier formatting applied: `npm run prettier:fix`
- [ ] ESLint checks passed: `npm run eslint:fix`
- [ ] Visual inspection in dev mode: `npm run dev:tauri`
- [ ] Light mode appearance verified
- [ ] Dark mode appearance verified
- [ ] Interactive states tested (hover, focus, active)
- [ ] Responsive behavior checked (mobile, tablet, desktop)
- [ ] Test suite executed: `npm run test`
- [ ] No visual regressions detected

---

## Known Issues & Edge Cases

### Files Requiring Manual Review

{{#each MANUAL_REVIEW_FILES}}

#### {{file_path}}

**Issue**: {{issue_description}}

**Location**: Line {{line_number}}

**Code**:

```tsx
{
  {
    code_snippet
  }
}
```

**Reason**: {{review_reason}}

**Suggested Action**: {{suggested_action}}

---

{{/each}}

### Complex Patterns

{{#each COMPLEX_PATTERNS}}

#### {{pattern_name}}

**Description**: {{description}}

**Examples**:
{{#each examples}}

- {{file}}: Line {{line}} - `{{code}}`
  {{/each}}

**Recommendation**: {{recommendation}}

---

{{/each}}

---

## Metrics

### Before Refactoring

```
Hardcoded Colors:     {{BEFORE_HARDCODED}}
Arbitrary Values:     {{BEFORE_ARBITRARY}}
Files with Issues:    {{BEFORE_FILES}}
Token Coverage:       {{BEFORE_COVERAGE}}%
```

### After Refactoring

```
Hardcoded Colors:     {{AFTER_HARDCODED}}
Arbitrary Values:     {{AFTER_ARBITRARY}}
Files with Issues:    {{AFTER_FILES}}
Token Coverage:       {{AFTER_COVERAGE}}%
```

### Improvement

```
Hardcoded Colors:     {{IMPROVEMENT_HARDCODED}}% reduction
Arbitrary Values:     {{IMPROVEMENT_ARBITRARY}}% reduction
Token Coverage:       +{{IMPROVEMENT_COVERAGE}}%
```

---

## Next Steps

### Immediate Actions

1. {{NEXT_STEP_1}}
2. {{NEXT_STEP_2}}
3. {{NEXT_STEP_3}}

### Long-term Recommendations

1. **Establish linting rules**: Add ESLint rules to prevent hardcoded colors
2. **Document patterns**: Update style guide with semantic token usage
3. **Team training**: Share knowledge about new token system
4. **Periodic audits**: Schedule quarterly reviews for consistency
5. **Expand tokens**: Consider additional tokens for edge cases discovered

---

## Appendix

### Semantic Token Reference

#### Core Tokens (Defined)

{{#each CORE_TOKENS}}

- `{{name}}`: {{description}}
  - Light: `hsl({{light_value}})`
  - Dark: `hsl({{dark_value}})`
    {{/each}}

#### Extended Tokens (Proposed)

{{#each EXTENDED_TOKENS}}

- `{{name}}`: {{description}}
  - Light: `hsl({{light_value}})`
  - Dark: `hsl({{dark_value}})`
    {{/each}}

### Color Contrast Report

{{#each CONTRAST_CHECKS}}

#### {{token_name}}

- **Light Mode**: {{light_contrast}} ({{light_wcag_level}})
- **Dark Mode**: {{dark_contrast}} ({{dark_wcag_level}})
- **Status**: {{status}}

{{/each}}

### Useful Commands

```bash
# Format code
npm run prettier:fix

# Lint and fix
npm run eslint:fix

# Run dev server
npm run dev:tauri

# Run tests
npm run test

# Build production
npm run build:tauri
```

---

**Audit completed by**: Claude Code (tailwind-auditor skill)
**Report version**: 1.0
**Last updated**: {{LAST_UPDATE}}
