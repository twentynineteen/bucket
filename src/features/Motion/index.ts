/**
 * Loader for the marketplace page. Returns { default: MotionMarketplacePage }
 * so React.lazy can use it directly without pulling the evaluator, exporters
 * or template JSON into the Settings chunk (A2).
 */
export const loadMotionMarketplacePage = () =>
  import('./components/MotionMarketplacePage')

/** Settings section for Motion prefs: library folder and default format */
export { default as MotionSection } from './components/MotionSection'
