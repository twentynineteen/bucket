import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

import App from './App'

import './index.css'

import { logger } from './utils/logger'

const rootElement = document.getElementById('root')

if (rootElement !== null && rootElement instanceof HTMLElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  logger.error('Root element not found')
}
