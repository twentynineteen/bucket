// tauri auto updater on app launch
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

// The AppRouter component switches the display if the user is not logged in
// The top level component, Page, acts as the provider for the layout
// subsequent components are loaded within the page window via the Outlet component.

import Page from './app/dashboard/page'
import { ExampleEmbeddings } from './pages/AI/ExampleEmbeddings/ExampleEmbeddings'
import ScriptFormatter from './pages/AI/ScriptFormatter/ScriptFormatter'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Baker from './pages/Baker/Baker'
import BuildProject from './pages/BuildProject/BuildProject'
import ConnectedApps from './pages/ConnectedApps'
import IngestHistory from './pages/IngestHistory'
import Posterframe from './pages/Posterframe'
import PremierePluginManager from './pages/PremierePluginManager/PremierePluginManager'
import Settings from './pages/Settings'
import UploadOtter from './pages/UploadOtter'
import UploadSprout from './pages/UploadSprout'
import UploadTrello from './pages/UploadTrello'
import { createNamespacedLogger } from './utils/logger'

const log = createNamespacedLogger('AppRouter')

// Extract download event handler to reduce nesting
type DownloadEvent = {
  event: 'Started' | 'Progress' | 'Finished'
  data: { contentLength?: number; chunkLength?: number }
}

function createDownloadHandler() {
  let downloaded = 0
  let contentLength = 0

  return (event: DownloadEvent) => {
    if (event.event === 'Started') {
      contentLength = event.data.contentLength || 0
      log.info(`Started downloading ${contentLength} bytes`)
      return
    }

    if (event.event === 'Progress') {
      downloaded += event.data.chunkLength || 0
      log.debug(`Downloaded ${downloaded} from ${contentLength}`)
      return
    }

    if (event.event === 'Finished') {
      log.info('Download finished')
    }
  }
}

// Extract update installation logic to reduce nesting
async function installUpdateAndRelaunch(update: {
  version: string
  downloadAndInstall: (handler: (event: DownloadEvent) => void) => Promise<void>
}) {
  log.info(`Found update: ${update.version}`)

  const downloadHandler = createDownloadHandler()
  await update.downloadAndInstall(downloadHandler)

  log.info('Update installed')
  await relaunch()
}

// Extract update check logic to reduce nesting
async function checkAndInstallUpdates() {
  if (process.env.NODE_ENV === 'development') {
    return // Skip updates in dev mode
  }

  try {
    const update = await check()
    log.debug('Update check result:', update)

    // Early return if no update available
    if (!update?.version) {
      log.debug('No update available')
      return
    }

    await installUpdateAndRelaunch(update)
  } catch (err) {
    log.error('Updater error:', err)
  }
}

export const AppRouter: React.FC = () => {
  const isAuthenticated = true // Track authentication state

  useEffect(() => {
    checkAndInstallUpdates()
  }, [])

  return (
    <Routes>
      {/* Ensure login and register routes are always accessible */}

      {/* Protect all other routes */}
      {!isAuthenticated ? (
        <>
          {/* <Route path="/" element={<Login />} /> */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* <Route path="*" element={<Navigate to="/login" />} /> */}
        </>
      ) : (
        <>
          {/* Default redirect to BuildProject */}
          <Route path="/" element={<Navigate to="/ingest/build" replace />} />

          {/* <Route path="*" element={<Navigate to="/ingest/build" />} /> */}
          <Route path="/" element={<Page />}>
            <Route path="ingest">
              <Route index element={<Navigate to="/ingest/build" replace />} />
              <Route path="history" element={<IngestHistory />} />
              <Route path="build" element={<BuildProject />} />
              <Route path="baker" element={<Baker />} />
            </Route>
            <Route path="ai-tools">
              <Route
                index
                element={<Navigate to="/ai-tools/script-formatter" replace />}
              />
              <Route path="script-formatter" element={<ScriptFormatter />} />
              <Route path="example-embeddings" element={<ExampleEmbeddings />} />
            </Route>
            <Route path="upload">
              <Route index element={<Navigate to="/upload/sprout" replace />} />
              <Route path="sprout" element={<UploadSprout />} />
              <Route path="posterframe" element={<Posterframe />} />
              <Route path="trello" element={<UploadTrello />} />
              <Route path="otter" element={<UploadOtter />} />
            </Route>
            <Route path="premiere">
              <Route
                index
                element={<Navigate to="/premiere/premiere-plugins" replace />}
              />
              <Route path="premiere-plugins" element={<PremierePluginManager />} />
            </Route>
            <Route path="settings">
              <Route index element={<Navigate to="/settings/general" replace />} />
              <Route path="general" element={<Settings />} />
              <Route path="connected-apps" element={<ConnectedApps />} />
            </Route>
          </Route>
        </>
      )}
    </Routes>
  )
}

export default AppRouter
