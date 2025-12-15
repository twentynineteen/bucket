/**
 * Premiere Pro Plugin Management Commands
 *
 * Handles installation and management of CEP (Common Extensibility Platform) extensions
 * for Adobe Premiere Pro. CEP extensions are packaged as ZXP files (signed ZIP archives).
 */

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};
use zip::ZipArchive;

#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub filename: String,
    pub size: u64,
    pub installed: bool,
    pub description: String,
    pub features: Vec<String>,
    pub icon: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub plugin_name: String,
    pub installed_path: String,
}

/// Get CEP extensions directory path
/// Prefers user-level directory (no admin required) over system-level
/// macOS: ~/Library/Application Support/Adobe/CEP/extensions/ (user) or
///        /Library/Application Support/Adobe/CEP/extensions/ (system)
/// Windows: %AppData%\Roaming\Adobe\CEP\extensions\ (user) or
///          C:\Program Files\Common Files\Adobe\CEP\extensions\ (system)
fn get_cep_extensions_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        // Prefer user-level directory (no admin privileges required)
        // Premiere Pro loads extensions from both user and system directories
        let user_dir = dirs::home_dir()
            .ok_or_else(|| "Could not determine home directory".to_string())?
            .join("Library/Application Support/Adobe/CEP/extensions");

        // Always use user directory - it doesn't require admin privileges
        Ok(user_dir)
    }

    #[cfg(target_os = "windows")]
    {
        // Prefer user-level directory (no admin privileges required)
        let user_dir = dirs::data_dir()
            .ok_or_else(|| "Could not determine AppData directory".to_string())?
            .join("Adobe/CEP/extensions");

        Ok(user_dir)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Unsupported operating system".to_string())
    }
}

/// Check if a plugin is installed by verifying the plugin directory
/// and manifest.xml file exist in either system or user directory
#[cfg_attr(not(any(target_os = "macos", target_os = "windows")), allow(unused_variables))]
fn check_plugin_installed_internal(plugin_name: &str) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // Check both system and user directories
        let system_dir = PathBuf::from("/Library/Application Support/Adobe/CEP/extensions");
        let system_plugin = system_dir.join(plugin_name);

        if system_plugin.exists() && system_plugin.join("CSXS/manifest.xml").exists() {
            return Ok(true);
        }

        // Check user directory
        if let Some(home) = dirs::home_dir() {
            let user_dir = home.join("Library/Application Support/Adobe/CEP/extensions");
            let user_plugin = user_dir.join(plugin_name);

            if user_plugin.exists() && user_plugin.join("CSXS/manifest.xml").exists() {
                return Ok(true);
            }
        }

        Ok(false)
    }

    #[cfg(target_os = "windows")]
    {
        // Check both system and user directories
        let system_dir = PathBuf::from("C:/Program Files/Common Files/Adobe/CEP/extensions");
        let system_plugin = system_dir.join(plugin_name);

        if system_plugin.exists() && system_plugin.join("CSXS/manifest.xml").exists() {
            return Ok(true);
        }

        // Check user directory
        if let Some(data_dir) = dirs::data_dir() {
            let user_dir = data_dir.join("Adobe/CEP/extensions");
            let user_plugin = user_dir.join(plugin_name);

            if user_plugin.exists() && user_plugin.join("CSXS/manifest.xml").exists() {
                return Ok(true);
            }
        }

        Ok(false)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Unsupported operating system".to_string())
    }
}

/// Get list of available plugins from assets
///
/// Returns hardcoded list of bundled plugins with their metadata
#[tauri::command]
pub async fn get_available_plugins() -> Result<Vec<PluginInfo>, String> {
    let plugins = vec![
        PluginInfo {
            name: "BreadcrumbsPremiere".to_string(),
            display_name: "Breadcrumbs Premiere".to_string(),
            version: "0.6.6".to_string(),
            filename: "BreadcrumbsPremiere_v0.6.6.zxp".to_string(),
            size: 605790,
            installed: check_plugin_installed_internal("BreadcrumbsPremiere").unwrap_or(false),
            description: "Breadcrumbs metadata panel for Premiere Pro. Integrates with Bucket's project management system.".to_string(),
            features: vec![
                "View breadcrumbs.json metadata in Premiere".to_string(),
                "Insert footage from the breadcrumbs file into the timeline and update the sequence title".to_string(),
                "Quickly add WBS watermarks and stings to your timeline".to_string(),

            ],
            icon: "/icons/plugins/adobe-Bc-S.svg".to_string(),
        },
        PluginInfo {
            name: "Boring".to_string(),
            display_name: "Boring".to_string(),
            version: "0.5.2".to_string(),
            filename: "Boring_v0.5.2.zxp".to_string(),
            size: 67035,
            installed: check_plugin_installed_internal("Boring").unwrap_or(false),
            description: "Replicates the 'Boring detector' feature from DaVinci Resolve. This plugin identifies points in the timeline where long clips have been used and can place markers to use as reference for creating cuts or edits.".to_string(),
            features: vec![
                "Analyze timeline for long clips".to_string(),
                "Place markers at boring points".to_string(),
                "Customizable detection thresholds".to_string(),
            ],
            icon: "/icons/plugins/logo.svg".to_string(),
        },
    ];

    Ok(plugins)
}

/// Install a plugin by extracting its ZXP file to the CEP extensions directory
///
/// # Arguments
/// * `app_handle` - Tauri app handle for resolving resource paths
/// * `plugin_filename` - Name of the ZXP file in assets/plugins/
/// * `plugin_name` - Name of the plugin (used for directory name)
///
/// # Process
/// 1. Locate ZXP file in bundled assets
/// 2. Get/create CEP extensions directory
/// 3. Backup existing installation if present
/// 4. Extract ZXP contents (it's a ZIP archive)
/// 5. Remove macOS quarantine attribute
/// 6. Verify installation
#[tauri::command]
pub async fn install_plugin(
    app_handle: AppHandle,
    plugin_filename: String,
    plugin_name: String,
) -> Result<InstallResult, String> {

    // Get ZXP file from assets
    // In dev mode: src-tauri/target/debug/resources/plugins/
    // In production: app.app/Contents/Resources/plugins/
    let resource_path = app_handle
        .path()
        .resolve(&format!("plugins/{}", plugin_filename), tauri::path::BaseDirectory::Resource)
        .map_err(|e| {
            let err_msg = format!("Could not resolve plugin path: {}", e);
            err_msg
        })?;

    if !resource_path.exists() {
        let err_msg = format!("Plugin file not found: {}", resource_path.display());
        return Err(err_msg);
    }

    // Get CEP directory
    let cep_dir = get_cep_extensions_dir()?;

    let target_dir = cep_dir.join(&plugin_name);

    // Create CEP extensions directory if it doesn't exist
    fs::create_dir_all(&cep_dir)
        .map_err(|e| {
            let err_msg = format!("Failed to create CEP directory: {} (Error: {})", cep_dir.display(), e);
            err_msg
        })?;


    // Backup existing installation
    if target_dir.exists() {
        let backup_name = format!(
            "{}_{}",
            plugin_name,
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        );
        let backup_dir = cep_dir.join(backup_name);

        fs::rename(&target_dir, &backup_dir)
            .map_err(|e| {
                let err_msg = format!("Failed to backup existing plugin: {}", e);
                err_msg
            })?;
    }

    // Create target directory
    fs::create_dir_all(&target_dir)
        .map_err(|e| {
            let err_msg = format!("Failed to create plugin directory: {} (Error: {})", target_dir.display(), e);
            err_msg
        })?;


    // Extract ZXP (it's a ZIP file)
    let file = fs::File::open(&resource_path)
        .map_err(|e| {
            let err_msg = format!("Failed to open plugin file: {}", e);
            err_msg
        })?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| {
            let err_msg = format!("Failed to read plugin archive: {}", e);
            err_msg
        })?;

    archive
        .extract(&target_dir)
        .map_err(|e| {
            let err_msg = format!("Failed to extract plugin: {}", e);
            err_msg
        })?;


    // macOS: Remove quarantine attribute
    #[cfg(target_os = "macos")]
    {

        let output = Command::new("xattr")
            .args([
                "-r",
                "-d",
                "com.apple.quarantine",
                target_dir.to_str().unwrap(),
            ])
            .output();

        match output {
            Ok(_) => println!("[INSTALL] Quarantine attribute removed"),
            Err(e) => println!("[INSTALL] Could not remove quarantine attribute: {}", e),
        }
    }

    // Verify installation
    let manifest_path = target_dir.join("CSXS/manifest.xml");


    if !manifest_path.exists() {
        let err_msg = format!("Installation failed: Invalid plugin structure (missing CSXS/manifest.xml at {})", manifest_path.display());

        return Err(err_msg);
    }


    Ok(InstallResult {
        success: true,
        message: format!("Successfully installed {} - restart Premiere Pro to use", plugin_name),
        plugin_name: plugin_name.clone(),
        installed_path: target_dir.to_string_lossy().to_string(),
    })
}

/// Check if a specific plugin is installed
#[tauri::command]
pub async fn check_plugin_installed(plugin_name: String) -> Result<bool, String> {
    check_plugin_installed_internal(&plugin_name)
}

/// Get CEP directory path
#[tauri::command]
pub async fn get_cep_directory() -> Result<String, String> {
    get_cep_extensions_dir().map(|p| p.to_string_lossy().to_string())
}

/// Enable CEP debug mode (macOS only, for self-signed extensions)
///
/// This allows self-signed CEP extensions to load without certificate warnings.
/// Must be run before launching Premiere Pro.
#[tauri::command]
pub async fn enable_cep_debug_mode() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("defaults")
            .args(["write", "com.adobe.CSXS.11", "PlayerDebugMode", "1"])
            .output()
            .map_err(|e| format!("Failed to enable debug mode: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(()) // No-op on Windows
    }
}

/// Open CEP extensions folder in file manager
#[tauri::command]
pub async fn open_cep_folder() -> Result<(), String> {
    let cep_dir = get_cep_extensions_dir()?;

    // Create directory if it doesn't exist
    if !cep_dir.exists() {
        fs::create_dir_all(&cep_dir)
            .map_err(|e| format!("Failed to create CEP directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&cep_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&cep_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
