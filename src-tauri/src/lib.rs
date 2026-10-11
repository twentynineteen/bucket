// Feature 004: Media types (VideoLink, TrelloCard)
pub mod media;

// #303: the one owner of breadcrumbs.json
pub mod breadcrumbs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
