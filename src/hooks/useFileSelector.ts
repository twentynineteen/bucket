import { open } from '@tauri-apps/plugin-dialog'

export async function selectFiles(): Promise<
  { file: { path: string; name: string }; camera: number }[]
> {
  const selectedPaths = await open({
    multiple: true,
    defaultPath: '/Volumes',
    filters: [
      { name: 'Videos', extensions: ['braw', 'mp4', 'mov', 'mxf'] },
      { name: 'Images', extensions: ['jpeg', 'jpg', 'png', 'gif'] }
    ]
  })

  if (!selectedPaths) return []

  return (Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths]).map((path) => ({
    file: { path, name: path.split('/').pop() || 'unknown' },
    camera: 1
  }))
}
