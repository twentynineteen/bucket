---
name: new-frontend-feature
description: Scaffolds new frontend pages/features with TDD approach, following established UI patterns from BuildProject/Baker pages. Generates page component, test file, updates routing, and maintains 90%+ test coverage before implementing production code. Use this when creating new pages or features in the Bucket app.
---

# New Frontend Feature Generator

## Overview

This skill scaffolds production-ready frontend features following the established patterns from BuildProject and Baker pages. It uses a TDD approach where tests are written first using the `test-specialist` skill, then generates the page component that passes those tests.

## Use This Skill When

- Creating a new page/feature in the Bucket app
- Adding a new tool to an existing dashboard section
- Starting a new workflow that needs consistent UI patterns
- You want TDD scaffolding with 90%+ test coverage out of the box

## Core Workflow

### Phase 1: Information Gathering

**Ask the user for the following information:**

1. **Feature Name**
   - Prompt: "What is the name of your new feature/page? (e.g., 'Video Analyzer', 'Batch Processor')"
   - Auto-convert to:
     - PascalCase for components: `VideoAnalyzer`
     - kebab-case for URLs: `/video-analyzer`
   - Store both versions for later use

2. **Dashboard Section**
   - Display current sections from app-sidebar.tsx:
     - Ingest footage
     - AI tools
     - Upload content
     - Settings
   - Prompt: "Which dashboard section should this feature belong to? (Enter number or 'new' for custom section)"
   - If 'new', ask: "What should the new section be called? (e.g., 'Analytics', 'Utilities')"
   - Store: section name, section URL pattern, whether it's new

3. **Icon Selection**
   - Based on feature name, suggest a Lucide icon (use AI reasoning):
     - "Video" → Video
     - "Analyzer" → ScanSearch, ChartBar
     - "Upload" → Upload, CloudUpload
     - "Format" → FileText, AlignLeft
     - "Batch" → Layers, Package
   - Prompt: "I suggest using the '{IconName}' icon from Lucide. Press Enter to accept or provide an alternative icon name."
   - Validate the icon exists in lucide-react (check against common icons)
   - Store: icon name

4. **Feature Description**
   - Prompt: "Provide a brief description of what this feature does (1-2 sentences):"
   - This will be used for:
     - Page subtitle
     - Test documentation
     - Comments in generated code
   - Store: description

**After collecting all information, display a summary:**

```
📋 Feature Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feature Name:     {FeatureName}
Component:        {FeatureName}.tsx
URL:              /{section}/{feature-name}
Section:          {Section Name} {new section indicator if applicable}
Icon:             {IconName}
Description:      {description}

Files to create:
  ✓ src/pages/{FeatureName}/{FeatureName}.tsx
  ✓ tests/unit/pages/{FeatureName}.test.tsx

Files to modify:
  ✓ src/components/app-sidebar.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask: "Proceed with scaffolding? (yes/no)"

---

### Phase 2: Write Tests First (TDD)

**Invoke the test-specialist skill to create comprehensive tests BEFORE implementing the component.**

Create test file at: `tests/unit/pages/{FeatureName}.test.tsx`

**Test requirements (90%+ coverage):**

1. **Rendering Tests**
   - Component renders without crashing
   - Page title displays correctly
   - Page description displays correctly
   - Error boundary wrapper is present

2. **Navigation Tests**
   - Breadcrumb hook is called with correct parameters
   - Breadcrumb displays section and feature names

3. **Structure Tests**
   - Header section exists with correct styling
   - Main content area exists
   - At least one step/section card is present

4. **Accessibility Tests**
   - Heading hierarchy is correct (h1 for title, h2 for sections)
   - ARIA labels if interactive elements present

**Test template to generate:**

```typescript
/**
 * {FeatureName} Page Tests
 *
 * {description}
 *
 * Test Coverage:
 * - Basic rendering and structure
 * - Breadcrumb navigation
 * - Error boundary integration
 * - Accessibility compliance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import {FeatureName} from '@/pages/{FeatureName}/{FeatureName}'

// Mock hooks and Tauri APIs
vi.mock('@/hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('{FeatureName}', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderWithProviders(<{FeatureName} />)
      expect(screen.getByText('{Feature Name}')).toBeInTheDocument()
    })

    it('should display page title', () => {
      renderWithProviders(<{FeatureName} />)
      expect(screen.getByRole('heading', { level: 1, name: '{Feature Name}' })).toBeInTheDocument()
    })

    it('should display page description', () => {
      renderWithProviders(<{FeatureName} />)
      expect(screen.getByText(/{description substring}/i)).toBeInTheDocument()
    })

    it('should render main content area', () => {
      renderWithProviders(<{FeatureName} />)
      const container = screen.getByText('{Feature Name}').closest('.w-full')
      expect(container).toBeInTheDocument()
    })

    it('should render at least one step section', () => {
      renderWithProviders(<{FeatureName} />)
      expect(screen.getByText(/Step 1:/i)).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should set breadcrumb navigation', async () => {
      const { useBreadcrumb } = await import('@/hooks/useBreadcrumb')

      renderWithProviders(<{FeatureName} />)

      expect(useBreadcrumb).toHaveBeenCalledWith([
        { label: '{Section Name}', href: '/{section-url}' },
        { label: '{Feature Name}' }
      ])
    })
  })

  describe('Error Boundary', () => {
    it('should wrap content in error boundary', () => {
      // This test verifies the ErrorBoundary wrapper exists
      // by checking if the fallback can be triggered
      renderWithProviders(<{FeatureName} />)
      // If ErrorBoundary is present, component should render normally
      expect(screen.getByText('{Feature Name}')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have correct heading hierarchy', () => {
      renderWithProviders(<{FeatureName} />)

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('{Feature Name}')

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements.length).toBeGreaterThan(0)
    })

    it('should have semantic HTML structure', () => {
      const { container } = renderWithProviders(<{FeatureName} />)

      // Check for proper container structure
      const mainContainer = container.querySelector('.w-full.h-full')
      expect(mainContainer).toBeInTheDocument()
    })
  })
})
```

**After test generation:**

1. Run the tests (they should fail - this is expected in TDD)
2. Display test output to user
3. Confirm: "Tests created and currently failing (as expected). Ready to implement the component? (yes/no)"

---

### Phase 3: Generate Page Component

Create file at: `src/pages/{FeatureName}/{FeatureName}.tsx`

**Component structure following BuildProject/Baker patterns:**

```typescript
/**
 * {FeatureName} Page Component
 *
 * {description}
 */

import { useBreadcrumb } from '@hooks/useBreadcrumb'
import ErrorBoundary from '@components/ErrorBoundary'
import { Button } from '@components/ui/button'
import { AlertTriangle, RefreshCw, {IconName} } from 'lucide-react'
import React, { useState } from 'react'

const {FeatureName}Content: React.FC = () => {
  // Set breadcrumbs for navigation
  useBreadcrumb([
    { label: '{Section Name}', href: '/{section-url}' },
    { label: '{Feature Name}' }
  ])

  // TODO: Add custom hook for business logic
  // Example: const { data, isLoading, error } = use{FeatureName}Logic()

  // Local state - expand as needed
  const [loading, setLoading] = useState(false)

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-card/50">
          <h1 className="text-2xl font-bold text-foreground">{Feature Name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4 max-w-full">
          {/* Step 1: Main section */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-foreground">
                  Step 1: Configure
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add your configuration options here
                </p>
              </div>
            </div>

            {/* TODO: Add your inputs, forms, or content here */}
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                This is a placeholder. Replace with your feature content.
              </p>

              <Button size="sm" className="gap-1.5">
                <{IconName} className="w-3.5 h-3.5" />
                Action Button
              </Button>
            </div>
          </div>

          {/* TODO: Add more steps/sections as needed */}
          {/*
          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                2
              </div>
              <h2 className="text-sm font-semibold text-foreground">
                Step 2: Process
              </h2>
            </div>
          </div>
          */}
        </div>
      </div>
    </div>
  )
}

const {FeatureName}: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {Feature Name} Error
            </h2>
            <div className="text-muted-foreground mb-6">
              <p>An error occurred while loading this page. This could be due to:</p>
              <ul className="text-left mt-2 space-y-1">
                <li>• Configuration issues</li>
                <li>• Network connectivity problems</li>
                <li>• Invalid data or state</li>
              </ul>
              {error && process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-left bg-muted/50 p-4 rounded-md text-sm border border-border">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Error:</strong> {error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={retry} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <{FeatureName}Content />
    </ErrorBoundary>
  )
}

export default {FeatureName}
```

**After component generation:**

- Confirm file created successfully
- Show file path to user

---

### Phase 4: Update Routing Configuration

Modify: `src/components/app-sidebar.tsx`

**Scenario A: Adding to Existing Section**

Find the appropriate section in the `navMain` array and add new item:

```typescript
{
  title: '{Existing Section}',
  url: '/existing/path',
  icon: ExistingIcon,
  isActive: false,
  items: [
    {
      title: 'Existing Feature',
      url: '/existing/feature'
    },
    {
      title: '{Feature Name}',  // ← New item
      url: '/{section}/{feature-name}'
    }
  ]
}
```

**Scenario B: Creating New Section**

Add new top-level section to `navMain` array:

```typescript
{
  title: '{New Section Name}',
  url: '/{new-section}/{feature-name}',
  icon: {IconName},
  isActive: false,
  items: [
    {
      title: '{Feature Name}',
      url: '/{new-section}/{feature-name}'
    }
  ]
}
```

**Important:**

- Maintain alphabetical or logical ordering of sections
- Ensure icon is imported: `import { {IconName} } from 'lucide-react'`
- Keep `isActive: false` for new items (user can change later)
- Use consistent URL patterns

**After routing update:**

- Display the changes made
- Show the navigation path: `{Section} > {Feature Name}`

---

### Phase 5: Run Tests & Verify

1. **Run the test suite:**

   ```bash
   bun run test -- {FeatureName}.test.tsx
   ```

2. **Check test results:**
   - All tests should now pass ✅
   - Coverage should be 90%+ ✅

3. **If tests fail:**
   - Display error messages
   - Analyze failures with test-specialist
   - Fix component code
   - Re-run tests
   - Iterate until all tests pass

4. **If tests pass:**
   - Display success message with coverage stats
   - Proceed to Phase 6

---

### Phase 6: Generate Summary Report

Display comprehensive summary to user:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Feature Scaffolding Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Feature: {Feature Name}
📍 Location: src/pages/{FeatureName}/{FeatureName}.tsx
🔗 URL: /{section}/{feature-name}
🎨 Icon: {IconName}

✅ Files Created
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 src/pages/{FeatureName}/{FeatureName}.tsx
🧪 tests/unit/pages/{FeatureName}.test.tsx

✅ Files Modified
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 src/components/app-sidebar.tsx
Added navigation: {Section} > {Feature Name}

✅ Test Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ All tests passing ({X}/{X})
✓ Coverage: {XX}% (target: 90%+)
✓ TDD workflow completed successfully

📋 Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review the generated component structure
2. Implement your business logic:
   - Create custom hook: src/hooks/use{FeatureName}.ts
   - Add state management if needed
   - Integrate Tauri commands for backend operations

3. Enhance the UI:
   - Add additional steps/sections
   - Implement forms or interactive elements
   - Add animations from @constants/animations

4. Backend integration (if needed):
   - Create Tauri commands in src-tauri/src/commands/
   - Update permissions in tauri.conf.json
   - Add API types to src/types/

5. Test your implementation:
   - npm run dev:tauri
   - Navigate to: {Section} > {Feature Name}
   - Verify functionality and styling

6. Additional testing:
   - Add integration tests if needed
   - Test with test-specialist skill
   - Run full test suite: npm run test

💡 Tips
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Follow BuildProject/Baker patterns for consistency
• Use TanStack React Query for data fetching (not useEffect)
• Leverage animation constants from @constants/animations
• Maintain 90%+ test coverage as you add features
• Use the test-specialist skill for additional test cases

🔗 Related Files to Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• src/pages/BuildProject/BuildProject.tsx (multi-step example)
• src/pages/Baker/Baker.tsx (master-detail example)
• src/constants/animations.ts (animation patterns)
• CLAUDE.md (project documentation)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Final confirmation:**
"Would you like me to open the generated files in your editor? (yes/no)"

---

## Integration with Other Skills

### test-specialist

- **When**: Phase 2 (test generation)
- **Purpose**: Generate comprehensive test suite with 90%+ coverage
- **Invocation**: Automatic during scaffolding

### ui-analyzer (Optional)

- **When**: After user implements their feature
- **Purpose**: Validate UI consistency across all pages
- **Invocation**: User can run manually

### ux-animation-guru (Optional)

- **When**: After basic implementation
- **Purpose**: Add polished animations to the new feature
- **Invocation**: User can run manually

---

## Common Icons Mapping

Use this AI reasoning to suggest appropriate icons:

| Feature Keywords       | Suggested Icons                     |
| ---------------------- | ----------------------------------- |
| video, media, play     | Video, Film, PlayCircle             |
| upload, import         | Upload, CloudUpload, FileUp         |
| download, export       | Download, FileDown, ArrowDownToLine |
| analyze, scan, search  | ScanSearch, Search, ChartBar        |
| format, text, document | FileText, AlignLeft, Type           |
| batch, multiple, bulk  | Layers, Package, FolderOpen         |
| settings, config       | Settings, Sliders, Wrench           |
| AI, smart, auto        | Sparkles, Zap, Brain                |
| calendar, schedule     | Calendar, Clock                     |
| database, storage      | Database, HardDrive, Save           |
| security, lock         | Lock, Shield, Key                   |
| user, profile          | User, UserCircle, Users             |
| chart, graph, data     | BarChart, LineChart, PieChart       |
| link, connect          | Link, Cable, Plug                   |
| trash, delete          | Trash2, X, XCircle                  |

---

## Error Handling

**If tests fail in Phase 5:**

1. Display test output
2. Ask test-specialist to analyze failures
3. Update component code
4. Re-run tests
5. Max 3 iterations - if still failing, alert user and ask for guidance

**If icon doesn't exist:**

1. Suggest alternative icon
2. Fallback to generic icon: FileQuestion

**If routing update fails:**

1. Show error message
2. Provide manual instructions for updating app-sidebar.tsx
3. Continue with rest of workflow

**If file already exists:**

1. Alert user: "File already exists at {path}"
2. Ask: "Overwrite, rename, or cancel?"
3. Respect user's choice

---

## Best Practices

1. **Always follow TDD**: Tests first, then implementation
2. **Maintain patterns**: Match BuildProject/Baker structure exactly
3. **Use path aliases**: Import with @/ prefix for consistency
4. **Semantic HTML**: Proper heading hierarchy, ARIA labels
5. **Accessibility**: Support reduced motion, keyboard navigation
6. **Error boundaries**: Always wrap pages for graceful failures
7. **Responsive design**: Use Tailwind utilities for all screen sizes
8. **TypeScript strict**: Full type safety, no 'any' types

---

## Location & Category

**Location**: managed
**Category**: Frontend Scaffolding & Code Generation
