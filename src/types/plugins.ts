/**
 * Type definitions for Premiere Pro Plugin Management
 *
 * These types define the structure for plugin information,
 * installation results, and related data exchanged between
 * the Tauri backend and React frontend.
 */

/**
 * Information about an available or installed plugin
 */
export interface PluginInfo {
  /** Internal plugin identifier (used for directory name) */
  name: string

  /** User-friendly display name */
  displayName: string

  /** Plugin version (e.g., "0.6.6") */
  version: string

  /** ZXP filename in assets folder */
  filename: string

  /** File size in bytes */
  size: number

  /** Whether the plugin is currently installed */
  installed: boolean

  /** Brief description of the plugin's purpose */
  description: string

  /** List of key features */
  features: string[]
}

/**
 * Result of a plugin installation operation
 */
export interface InstallResult {
  /** Whether installation succeeded */
  success: boolean

  /** User-friendly message about the result */
  message: string

  /** Name of the plugin that was installed */
  pluginName: string

  /** Full path where plugin was installed */
  installedPath: string
}
