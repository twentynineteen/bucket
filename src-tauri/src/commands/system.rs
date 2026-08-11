use std::env;
use std::process::Command;
use tauri::command;

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
