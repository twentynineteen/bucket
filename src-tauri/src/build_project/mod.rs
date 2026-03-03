//! Build Project module for file transfer operations with cancellation support.
//!
//! This module provides infrastructure for managing long-running file operations
//! in the BuildProject workflow, including:
//!
//! - **OperationRegistry**: Centralized registry for tracking and cancelling operations
//! - **Transfer types**: Data structures for file transfer progress and results
//! - **Error types**: Strongly-typed errors for build project operations
//!
//! # Example
//!
//! ```rust,ignore
//! use build_project::{OperationRegistry, TransferProgress, TransferStatus};
//!
//! // Create a shared registry (typically managed by Tauri state)
//! let registry = OperationRegistry::new();
//!
//! // Register a new operation before starting file transfer
//! let (operation_id, cancel_receiver) = registry.register().await;
//!
//! // During file transfer, periodically check for cancellation
//! if OperationRegistry::is_cancelled(&cancel_receiver) {
//!     // Clean up and return early
//!     return;
//! }
//!
//! // When operation completes, remove from registry
//! registry.complete(&operation_id).await;
//! ```

pub mod commands;
pub mod error;
mod registry;
mod transfer;

pub use commands::*;
pub use error::*;
pub use registry::*;
pub use transfer::*;
