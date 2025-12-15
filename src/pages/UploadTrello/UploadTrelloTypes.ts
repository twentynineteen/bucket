import { SproutUploadResponse } from '@utils/types'

export interface SelectedCard {
  id: string
  name: string
}

export interface UploadTrelloState {
  selectedCard: SelectedCard | null
  searchTerm: string
}

export const createDefaultSproutUploadResponse = (): SproutUploadResponse => ({
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  height: 0,
  width: 0,
  description: '',
  id: '',
  plays: 0,
  title: '',
  source_video_file_size: 0,
  embed_code: '',
  state: 'default_state',
  security_token: '',
  progress: 0,
  tags: [],
  embedded_url: null,
  duration: 0,
  password: null,
  privacy: 0,
  requires_signed_embeds: false,
  selected_poster_frame_number: 0,
  assets: {
    videos: {
      '240p': '',
      '360p': '',
      '480p': '',
      '720p': '',
      '1080p': '',
      '2k': null,
      '4k': null,
      '8k': null,
      source: null
    },
    thumbnails: [],
    poster_frames: [],
    poster_frame_mp4: null,
    timeline_images: [],
    hls_manifest: ''
  },
  download_sd: null,
  download_hd: null,
  download_source: null,
  allowed_domains: null,
  allowed_ips: null,
  player_social_sharing: null,
  player_embed_sharing: null,
  require_email: false,
  require_name: false,
  hide_on_site: false,
  folder_id: null,
  airplay_support: null,
  session_watermarks: null,
  direct_file_access: null
})
