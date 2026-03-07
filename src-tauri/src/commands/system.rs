use std::env;
use std::process::Command;
use tauri::{command, AppHandle};

#[tauri::command]
pub async fn graceful_restart(_app_handle: AppHandle) -> Result<(), String> {
    // Perform any cleanup needed before restarting.

    // In debug mode (development), the executable might not be available.
    // We can simply log and exit or do nothing.
    if cfg!(debug_assertions) {
        println!("Graceful restart is not supported in development mode.");
        return Ok(());
    }

    // Get the current executable's path.
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;

    // Check if the executable exists.
    if !current_exe.exists() {
        return Err(format!(
            "Executable not found at: {}",
            current_exe.display()
        ));
    }

    // Spawn a new instance of the application.
    Command::new(current_exe)
        .spawn()
        .map_err(|e| format!("Failed to spawn new process: {}", e))?;

    // Optionally, perform any final cleanup here.

    // Exit the current application.
    std::process::exit(0);
}

#[command]
pub fn get_username() -> String {
    match env::var("USERNAME").or(env::var("USER")) {
        Ok(username) => username,
        Err(_) => "Unknown User".to_string(),
    }
}

#[tauri::command]
pub fn open_folder(path: String) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg(path)
            .spawn()
            .expect("Failed to open folder")
            .wait();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("explorer")
            .arg(path.replace("/", "\\"))
            .spawn()
            .expect("Failed to open folder")
            .wait();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open")
            .arg(path)
            .spawn()
            .expect("Failed to open folder")
            .wait();
    }
}
