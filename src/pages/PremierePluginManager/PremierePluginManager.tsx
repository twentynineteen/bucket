/**
 * Premiere Plugin Manager Page Component
 *
 * Install and manage Premiere Pro CEP extensions directly from the app.
 * Automatically deploys plugin updates to your Premiere Pro installation.
 */

import ErrorBoundary from '@components/ErrorBoundary'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@components/ui/alert-dialog'
import { Button } from '@components/ui/button'
import { useBreadcrumb } from '@hooks/useBreadcrumb'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FolderOpen,
  Package,
  RefreshCw
} from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'

interface PluginInfo {
  name: string
  displayName: string
  version: string
  filename: string
  size: number
  installed: boolean
  description: string
  features: string[]
  icon: string
}

interface InstallResult {
  success: boolean
  message: string
  pluginName: string
  installedPath: string
}

const PremierePluginManagerContent: React.FC = () => {
  // Set breadcrumbs for navigation
  useBreadcrumb([
    { label: 'Premiere plugins', href: '/premiere/' },
    { label: 'Premiere Plugin Manager' }
  ])

  const queryClient = useQueryClient()
  const [successDialog, setSuccessDialog] = useState<{
    open: boolean
    pluginName: string
    displayName: string
    installedPath: string
  }>({
    open: false,
    pluginName: '',
    displayName: '',
    installedPath: ''
  })

  // Fetch available plugins
  const {
    data: plugins,
    isLoading,
    error
  } = useQuery({
    queryKey: ['plugins'],
    queryFn: async () => {
      return await invoke<PluginInfo[]>('get_available_plugins')
    }
  })

  // Install plugin mutation
  const installMutation = useMutation({
    mutationFn: async ({
      filename,
      name,
      displayName
    }: {
      filename: string
      name: string
      displayName: string
    }) => {
      const result = await invoke<InstallResult>('install_plugin', {
        pluginFilename: filename,
        pluginName: name
      })
      return { ...result, displayName }
    },
    onSuccess: (result) => {
      // Show temporary toast for debugging
      toast.success(`Plugin installed to: ${result.installedPath}`)

      // Show success dialog with restart instructions
      setSuccessDialog({
        open: true,
        pluginName: result.pluginName,
        displayName: result.displayName,
        installedPath: result.installedPath
      })
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
    },
    onError: (error: Error) => {
      toast.error(`Installation failed: ${error.message}`)
    }
  })

  // Open CEP folder
  const handleOpenFolder = async () => {
    try {
      await invoke('open_cep_folder')
    } catch (error) {
      toast.error(`Failed to open folder: ${error}`)
    }
  }

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <h1 className="text-foreground text-2xl font-bold">Premiere Plugin Manager</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Install and manage Premiere Pro CEP extensions directly from the app.
            Automatically deploys plugin updates to your Premiere Pro installation.
          </p>
        </div>

        <div className="max-w-full space-y-4 px-6 py-4">
          {/* Step 1: Available Plugins */}
          <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                1
              </div>
              <div className="flex-1">
                <h2 className="text-foreground text-sm font-semibold">
                  Available Plugins
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Install Premiere Pro extensions with one click
                </p>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="text-primary mr-2 h-5 w-5 animate-spin" />
                <span className="text-muted-foreground text-sm">Loading plugins...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-destructive/10 border-destructive/30 mt-3 rounded-lg border p-4">
                <div className="flex items-center">
                  <AlertTriangle className="text-destructive mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="text-destructive text-sm">
                    Error loading plugins:{' '}
                    {error instanceof Error ? error.message : 'Unknown error'}
                  </span>
                </div>
              </div>
            )}

            {/* Plugin List */}
            {plugins && plugins.length > 0 && (
              <div className="mt-3 space-y-3">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.name}
                    className="bg-card border-border rounded-xl border p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      {/* Plugin Icon */}
                      <div className="bg-primary/10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg">
                        <img
                          src={plugin.icon}
                          alt={`${plugin.displayName} icon`}
                          className="h-10 w-10 object-contain"
                          onError={(e) => {
                            // Fallback to Package icon if image fails to load
                            e.currentTarget.style.display = 'none'
                            const fallback = e.currentTarget
                              .nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'block'
                          }}
                        />
                        <Package
                          className="text-primary hidden h-8 w-8"
                          style={{ display: 'none' }}
                        />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-foreground text-lg font-semibold">
                              {plugin.displayName}
                            </h3>
                            <p className="text-muted-foreground text-xs">
                              v{plugin.version} • {(plugin.size / 1024).toFixed(0)} KB
                            </p>
                          </div>

                          {plugin.installed ? (
                            <div className="bg-success/20 text-success flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
                              <CheckCircle className="h-3 w-3" />
                              Installed
                            </div>
                          ) : (
                            <div className="bg-muted text-muted-foreground flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
                              <Package className="h-3 w-3" />
                              Not Installed
                            </div>
                          )}
                        </div>

                        <p className="text-muted-foreground mb-3 text-sm">
                          {plugin.description}
                        </p>

                        <div className="mb-3">
                          <p className="text-foreground mb-1 text-xs font-semibold">
                            Features:
                          </p>
                          <ul className="space-y-1">
                            {plugin.features.map((feature, idx) => (
                              <li
                                key={idx}
                                className="text-muted-foreground flex items-start gap-1 text-xs"
                              >
                                <span className="text-primary mt-0.5">•</span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button
                          onClick={() =>
                            installMutation.mutate({
                              filename: plugin.filename,
                              name: plugin.name,
                              displayName: plugin.displayName
                            })
                          }
                          disabled={
                            (installMutation.isPending &&
                              installMutation.variables?.name === plugin.name) ||
                            plugin.installed
                          }
                          size="sm"
                          className="gap-1.5"
                        >
                          {installMutation.isPending &&
                          installMutation.variables?.name === plugin.name ? (
                            <>
                              <Download className="h-3.5 w-3.5 animate-pulse" />
                              Installing...
                            </>
                          ) : plugin.installed ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5" />
                              Installed
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              Install Plugin
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Settings */}
          <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                2
              </div>
              <div className="flex-1">
                <h2 className="text-foreground text-sm font-semibold">Settings</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Manage plugin installation settings
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <p className="text-foreground mb-2 text-xs font-semibold">
                  CEP Extensions Folder
                </p>
                <Button
                  onClick={handleOpenFolder}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Open Extensions Folder
                </Button>
              </div>

              <div className="border-border border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  After installing plugins, restart Premiere Pro to see them in{' '}
                  <strong className="text-foreground">Window &gt; Extensions</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <AlertDialog
        open={successDialog.open}
        onOpenChange={(open) => setSuccessDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="text-success h-5 w-5" />
              Plugin Installed Successfully
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{successDialog.displayName}</strong> has
              been installed to your Premiere Pro extensions folder.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="bg-primary/10 border-primary/20 rounded-lg border p-3">
              <p className="text-foreground mb-1 text-sm font-semibold">Next Steps:</p>
              <ol className="list-inside list-decimal space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Restart Premiere Pro</strong> if
                  it's currently running
                </li>
                <li>
                  Open the plugin from{' '}
                  <strong className="text-foreground">Window → Extensions</strong>
                </li>
                <li>Start using the new features!</li>
              </ol>
            </div>

            <details className="text-xs">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                Installation Details
              </summary>
              <div className="mt-2 space-y-2">
                <div className="bg-muted text-muted-foreground rounded p-2 font-mono text-xs break-all">
                  {successDialog.installedPath}
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await invoke('open_cep_folder')
                    } catch (error) {
                      toast.error(`Failed to open folder: ${error}`)
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Open Plugin Folder
                </Button>
              </div>
            </details>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setSuccessDialog((prev) => ({ ...prev, open: false }))}
            >
              Got it!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const PremierePluginManager: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h2 className="text-foreground mb-4 text-2xl font-semibold">
              Premiere Plugin Manager Error
            </h2>
            <div className="text-muted-foreground mb-6">
              <p>An error occurred while loading this page. This could be due to:</p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• Plugin file access issues</li>
                <li>• CEP directory permissions</li>
                <li>• System compatibility problems</li>
              </ul>
              {error && process.env.NODE_ENV === 'development' && (
                <details className="bg-muted/50 border-border mt-4 rounded-md border p-4 text-left text-sm">
                  <summary className="text-foreground cursor-pointer font-medium">
                    Technical Details
                  </summary>
                  <div className="text-muted-foreground mt-2">
                    <p>
                      <strong className="text-foreground">Error:</strong> {error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <Button onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )}
    >
      <PremierePluginManagerContent />
    </ErrorBoundary>
  )
}

export default PremierePluginManager
