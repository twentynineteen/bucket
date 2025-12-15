#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Module declarations
mod baker;
mod commands;
mod state;
mod utils;

// Imports
use log::info;
use simple_logger::SimpleLogger;
use std::sync::Mutex;

// Re-exports from modules
use baker::*;
use commands::*;
use state::AuthState;

fn main() {
    SimpleLogger::new().init().unwrap();

    info!("Tauri App Started");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            Ok(())
        })
        .manage(AuthState {
            tokens: Mutex::new(vec![]),
        })
        .manage(baker::ScanState::new())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_macos_permissions::init())
        .invoke_handler(tauri::generate_handler![
            get_folders,
            upload_video,
            graceful_restart,
            check_auth,
            add_token,
            move_files,
            copy_premiere_project,
            show_confirmation_dialog,
            open_resource_file,
            get_username,
            open_folder,
            baker_start_scan,
            baker_get_scan_status,
            baker_cancel_scan,
            baker_validate_folder,
            baker_read_breadcrumbs,
            baker_update_breadcrumbs,
            baker_scan_current_files,
            get_folder_size,
            baker_read_raw_breadcrumbs,
            // Feature 004: Multiple video links and Trello cards
            baker_get_video_links,
            baker_associate_video_link,
            baker_remove_video_link,
            baker_update_video_link,
            baker_reorder_video_links,
            baker_get_trello_cards,
            baker_associate_trello_card,
            baker_remove_trello_card,
            baker_fetch_trello_card_details,
            fetch_trello_boards,
            // Feature 004 Phase 2: Sprout Video URL auto-fetch
            fetch_sprout_video_details,
            // Feature 006: AI-Powered Autocue Script Formatter
            parse_docx_file,
            generate_docx_file,
            validate_docx_file,
            validate_provider_connection,
            validate_provider_with_auth,
            // Feature 006 RAG: Vector search for script examples
            search_similar_scripts,
            get_example_by_id,
            get_all_examples,
            // Feature 007: Example embedding management
            get_all_examples_with_metadata,
            upload_example,
            replace_example,
            delete_example,
            // Premiere Pro Plugin Management
            get_available_plugins,
            install_plugin,
            check_plugin_installed,
            get_cep_directory,
            enable_cep_debug_mode,
            open_cep_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
