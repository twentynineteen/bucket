// types.ts
// Define the interface for a SproutVideo folder.
export interface SproutFolder {
  id: string
  name: string
  parent_id: string | null
}

// The expected API response from the Tauri command.
export interface GetFoldersResponse {
  folders: SproutFolder[]
}

// interface for camera number and footage filename
export interface FootageData {
  camera: number
  name: string
  path: string
}

// interface for breadcrumb / project files first declared in BuildProject.tsx
export interface Breadcrumb {
  projectTitle?: string
  numberOfCameras?: number
  files?: FootageData[]
  parentFolder?: string
  createdBy?: string | { data?: string; [key: string]: unknown }
  creationDateTime?: string
  folderSizeBytes?: number
  trelloCardUrl?: string
}

// Interface representing the JSON response from SproutVideo upload
export interface SproutUploadResponse {
  created_at: string
  updated_at: string
  height: number
  width: number
  description: string
  id: string
  plays: number
  title: string
  source_video_file_size: number
  embed_code: string
  state: string
  security_token: string
  progress: number
  tags: string[]
  embedded_url: string | null
  duration: number
  password: string | null
  privacy: number
  requires_signed_embeds: boolean
  selected_poster_frame_number: number
  assets: {
    videos: {
      '240p': string
      '360p': string
      '480p': string
      '720p': string
      '1080p': string
      '2k': string | null
      '4k': string | null
      '8k': string | null
      source: string | null
    }
    thumbnails: string[]
    poster_frames: string[]
    poster_frame_mp4: string | null
    timeline_images: string[]
    hls_manifest: string
  }
  download_sd: string | null
  download_hd: string | null
  download_source: string | null
  allowed_domains: string | null
  allowed_ips: string | null
  player_social_sharing: string | null
  player_embed_sharing: string | null
  require_email: boolean
  require_name: boolean
  hide_on_site: boolean
  folder_id: string | null
  airplay_support: string | null
  session_watermarks: string | null
  direct_file_access: string | null
}

// Define an interface for folder data (adjust fields as needed)
export interface SproutFolder {
  id: string
  name: string
  parent_id: string | null // Null means a root folder
}
