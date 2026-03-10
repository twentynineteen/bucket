// tauri auto updater on app launch
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import React, { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

// The AppRouter component switches the display if the user is not logged in
// The top level component, Page, acts as the provider for the layout
// subsequent components are loaded within the page window via the Outlet component.

import Page from './app/dashboard/page'
import { createNamespacedLogger } from '@shared/utils/logger'

// Lazy-loaded route components -- each produces a separate chunk for
// smaller initial bundle and faster startup.
const ExampleEmbeddings = React.lazy(() =>
  import('@features/AITools').then((m) => ({ default: m.ExampleEmbeddings }))
)
const ScriptFormatter = React.lazy(() =>
  import('@features/AITools').then((m) => ({ default: m.ScriptFormatter }))
)
const Login = React.lazy(() =>
  import('@features/Auth').then((m) => ({ default: m.Login }))
)
const Register = React.lazy(() =>
  import('@features/Auth').then((m) => ({ default: m.Register }))
)
const Baker = React.lazy(() =>
  import('@features/Baker').then((m) => ({ default: m.BakerPage }))
)
const BuildProjectPage = React.lazy(() =>
  import('@features/BuildProject').then((m) => ({
    default: m.BuildProjectPage
  }))
)
const IngestHistory = React.lazy(() => import('./pages/IngestHistory'))
const Settings = React.lazy(() =>
  import('@features/Settings').then((m) => ({ default: m.Settings }))
)
const Posterframe = React.lazy(() =>
  import('@features/Upload').then((m) => ({ default: m.Posterframe }))
)
const UploadOtter = React.lazy(() =>
  import('@features/Upload').then((m) => ({ default: m.UploadOtter }))
)
const UploadSprout = React.lazy(() =>
  import('@features/Upload').then((m) => ({ default: m.UploadSprout }))
)
const PremierePluginManager = React.lazy(() =>
  import('@features/Premiere').then((m) => ({
    default: m.PremierePluginManager
  }))
)
const UploadTrello = React.lazy(() =>
  import('@features/Trello').then((m) => ({ default: m.UploadTrello }))
)

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
              <Route path="build" element={<BuildProjectPage />} />
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
            </Route>
          </Route>
        </>
      )}
    </Routes>
  )
}

export default AppRouter
