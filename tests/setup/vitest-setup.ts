import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

// Mock matchMedia IMMEDIATELY at module load time
// This is required for both our code and Framer Motion's reduced motion detection
const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(), // deprecated
  removeListener: vi.fn(), // deprecated
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMedia)
})

// Also ensure global.matchMedia exists for Node environment
if (typeof global !== 'undefined') {
  Object.defineProperty(global, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(mockMatchMedia)
  })
}

// Mock framer-motion to avoid animation-related issues in tests
vi.mock('framer-motion', () => {
  const React = require('react')
  return {
    motion: new Proxy(
      {},
      {
        get:
          (_target, prop) =>
          ({ children, ...props }: any) => {
            // Strip out framer-motion specific props to avoid React warnings
            const {
              initial,
              animate,
              exit,
              variants,
              transition,
              whileHover,
              whileTap,
              whileFocus,
              whileDrag,
              whileInView,
              drag,
              dragConstraints,
              dragElastic,
              dragMomentum,
              layout,
              layoutId,
              onAnimationStart,
              onAnimationComplete,
              ...domProps
            } = props
            // Add data-projection-id to simulate framer-motion element
            return React.createElement(prop, { ...domProps, 'data-projection-id': '1' }, children)
          }
      }
    ),
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn()
    }),
    useMotionValue: (initial: any) => ({ get: () => initial, set: vi.fn() }),
    useTransform: () => ({ get: () => 0, set: vi.fn() }),
    useSpring: () => ({ get: () => 0, set: vi.fn() }),
    useScroll: () => ({
      scrollX: { get: () => 0 },
      scrollY: { get: () => 0 },
      scrollXProgress: { get: () => 0 },
      scrollYProgress: { get: () => 0 }
    }),
    useVelocity: () => ({ get: () => 0 }),
    useInView: () => true,
    useDragControls: () => ({
      start: vi.fn()
    }),
    MotionConfig: ({ children }: any) => children,
    LazyMotion: ({ children }: any) => children,
    domAnimation: {},
    domMax: {},
    m: new Proxy(
      {},
      {
        get:
          (_target, prop) =>
          ({ children, ...props }: any) => {
            const React = require('react')
            const {
              initial,
              animate,
              exit,
              variants,
              transition,
              whileHover,
              whileTap,
              whileFocus,
              whileDrag,
              whileInView,
              drag,
              dragConstraints,
              dragElastic,
              dragMomentum,
              layout,
              layoutId,
              onAnimationStart,
              onAnimationComplete,
              ...domProps
            } = props
            // Add data-projection-id to simulate framer-motion element
            return React.createElement(prop, { ...domProps, 'data-projection-id': '1' }, children)
          }
      }
    )
  }
})

// Mock Tauri window API globally (must be before other mocks)
// This creates a reusable mock window object that all hooks can use
const createMockWindow = () => ({
  setPosition: vi.fn().mockResolvedValue(undefined),
  setSize: vi.fn().mockResolvedValue(undefined),
  outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
  outerSize: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
  onResized: vi.fn().mockResolvedValue(vi.fn()),
  onMoved: vi.fn().mockResolvedValue(vi.fn()),
  theme: vi.fn().mockResolvedValue('light'),
  onThemeChanged: vi.fn().mockResolvedValue(vi.fn())
})

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => createMockWindow())
}))

// Mock Tauri APIs
const mockTauriApis = () => {
  // Note: We don't mock @tauri-apps/api/core here because mockIPC() from
  // tauri-mocks.ts handles invoke() mocking for contract/integration tests.
  // Individual tests can use vi.mock() locally if they need custom behavior.

  // Mock event listeners - must return unlisten function to avoid cleanup errors
  vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn().mockResolvedValue(vi.fn()),
    emit: vi.fn().mockResolvedValue(undefined)
  }))

  // Mock app functions
  vi.mock('@tauri-apps/api/app', () => ({
    getVersion: vi.fn().mockResolvedValue('1.0.0')
  }))

  // Mock plugin-dialog
  vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn()
  }))

  // Mock plugin-shell
  vi.mock('@tauri-apps/plugin-shell', () => ({
    open: vi.fn()
  }))

  // Mock plugin-process
  vi.mock('@tauri-apps/plugin-process', () => ({
    relaunch: vi.fn()
  }))

  // Mock plugin-updater
  vi.mock('@tauri-apps/plugin-updater', () => ({
    check: vi.fn()
  }))

  // Mock plugin-store
  vi.mock('@tauri-apps/plugin-store', () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  }))

  // Mock Tauri path APIs (used by storage utilities)
  vi.mock('@tauri-apps/api/path', () => ({
    appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
    appConfigDir: vi.fn().mockResolvedValue('/mock/app/config'),
    appCacheDir: vi.fn().mockResolvedValue('/mock/app/cache'),
    appLocalDataDir: vi.fn().mockResolvedValue('/mock/app/local-data')
  }))

  // Mock window API for useWindowState and useSystemTheme hooks
  vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: vi.fn(() => ({
      setPosition: vi.fn().mockResolvedValue(undefined),
      setSize: vi.fn().mockResolvedValue(undefined),
      outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
      outerSize: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
      onResized: vi.fn().mockResolvedValue(vi.fn()),
      onMoved: vi.fn().mockResolvedValue(vi.fn()),
      onThemeChanged: vi.fn().mockResolvedValue(vi.fn())
    }))
  }))

  // Don't globally mock @tauri-apps/api/core here, because:
  // 1. Contract tests use mockIPC() from @tauri-apps/api/mocks which handles invoke()
  // 2. Unit tests that need invoke() mocking should do it locally with vi.mock()
  // 3. Global mocking prevents mockIPC() from working properly
}

// Mock browser APIs
const mockBrowserApis = () => {
  // Configure React Testing Library act() environment for React 18
  ;(global as any).IS_REACT_ACT_ENVIRONMENT = true

  // Mock Tauri window internals for getCurrentWindow() and invoke
  ;(window as any).__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'main' }
    },
    invoke: vi.fn().mockResolvedValue(undefined)
  }

  // Mock ResizeObserver for react-virtual compatibility
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
    constructor(_callback: ResizeObserverCallback) {
      // Constructor required for react-virtual
    }
  }

  // Mock getBoundingClientRect for virtual scrolling in tests
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => {}
  }))

  // Mock TextEncoder/TextDecoder for Node.js environment
  if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util')
    global.TextEncoder = TextEncoder
    global.TextDecoder = TextDecoder
  }

  // Mock Element.prototype.scrollTo for smooth scrolling in tests
  if (typeof Element.prototype.scrollTo === 'undefined') {
    Element.prototype.scrollTo = vi.fn()
  }

  // Mock fetch if not available
  if (typeof global.fetch === 'undefined') {
    global.fetch = vi.fn()
  }

  // Polyfill AbortSignal.timeout for Node.js test environment
  if (typeof AbortSignal.timeout === 'undefined') {
    AbortSignal.timeout = function (ms: number): AbortSignal {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new Error('TimeoutError')), ms)
      return controller.signal
    }
  }
}

beforeAll(() => {
  mockTauriApis()
  mockBrowserApis()
})

afterEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  vi.restoreAllMocks()
})

// Export common test utilities
export const createMockQueryClient = async () => {
  const { QueryClient } = await import('@tanstack/react-query')
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  })
}

export const createWrapper = (queryClient?: any) => {
  return ({ children }: { children: React.ReactNode }) => {
    const React = require('react')
    const { QueryClientProvider } = require('@tanstack/react-query')
    const client =
      queryClient ||
      new (require('@tanstack/react-query').QueryClient)({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false }
        }
      })

    return React.createElement(QueryClientProvider, { client }, children)
  }
}
