use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{watch, RwLock};
use uuid::Uuid;

/// Registry for managing cancellable operations.
///
/// The OperationRegistry provides a centralized way to track and cancel
/// long-running operations. Each operation is assigned a unique ID and
/// can be cancelled by calling the `cancel` method with that ID.
///
/// This implementation uses `tokio::sync::watch` channels for efficient
/// cancellation signaling across async tasks.
///
/// # Example
///
/// ```rust,ignore
/// use build_project::OperationRegistry;
///
/// let registry = OperationRegistry::new();
///
/// // Register a new operation
/// let (operation_id, cancel_receiver) = registry.register().await;
///
/// // In the operation's task, check for cancellation
/// if OperationRegistry::is_cancelled(&cancel_receiver) {
///     // Handle cancellation
///     return;
/// }
///
/// // Cancel the operation from another task
/// registry.cancel(&operation_id).await;
///
/// // Clean up when operation completes
/// registry.complete(&operation_id).await;
/// ```
#[derive(Clone)]
pub struct OperationRegistry {
    operations: Arc<RwLock<HashMap<String, watch::Sender<bool>>>>,
}

impl OperationRegistry {
    /// Create a new OperationRegistry
    pub fn new() -> Self {
        Self {
            operations: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new operation.
    ///
    /// Returns a tuple containing:
    /// - `operation_id`: A unique identifier for the operation
    /// - `cancel_receiver`: A watch receiver that will receive `true` when cancelled
    ///
    /// The receiver's initial value is `false`, and will become `true` when
    /// `cancel()` is called with the corresponding operation ID.
    pub async fn register(&self) -> (String, watch::Receiver<bool>) {
        let operation_id = Uuid::new_v4().to_string();
        let (tx, rx) = watch::channel(false);

        let mut operations = self.operations.write().await;
        operations.insert(operation_id.clone(), tx);

        (operation_id, rx)
    }

    /// Cancel an operation by ID.
    ///
    /// Returns `true` if the operation was found and cancelled,
    /// `false` if the operation ID was not found in the registry.
    ///
    /// After calling this method, any receiver associated with this
    /// operation will see `true` when checked with `is_cancelled()`.
    pub async fn cancel(&self, operation_id: &str) -> bool {
        let operations = self.operations.read().await;

        if let Some(sender) = operations.get(operation_id) {
            // Send cancellation signal - ignore error if receiver is dropped
            let _ = sender.send(true);
            true
        } else {
            false
        }
    }

    /// Remove a completed operation from the registry.
    ///
    /// This should be called when an operation completes (successfully or not)
    /// to free up resources. After calling this method, the operation ID
    /// can no longer be used to cancel the operation.
    pub async fn complete(&self, operation_id: &str) {
        let mut operations = self.operations.write().await;
        operations.remove(operation_id);
    }

    /// Check if an operation has been cancelled.
    ///
    /// This is a static method that can be called with any watch receiver
    /// to check if the associated operation has been cancelled.
    ///
    /// Returns `true` if the operation has been cancelled, `false` otherwise.
    pub fn is_cancelled(receiver: &watch::Receiver<bool>) -> bool {
        *receiver.borrow()
    }

    /// Get the number of currently registered operations.
    ///
    /// This is primarily useful for debugging and testing purposes.
    pub async fn operation_count(&self) -> usize {
        let operations = self.operations.read().await;
        operations.len()
    }

    /// Check if an operation exists in the registry.
    ///
    /// Returns `true` if the operation ID is registered, `false` otherwise.
    pub async fn has_operation(&self, operation_id: &str) -> bool {
        let operations = self.operations.read().await;
        operations.contains_key(operation_id)
    }
}

impl Default for OperationRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_register_creates_unique_ids() {
        let registry = OperationRegistry::new();

        let (id1, _) = registry.register().await;
        let (id2, _) = registry.register().await;

        assert_ne!(id1, id2);
    }

    #[tokio::test]
    async fn test_initial_state_not_cancelled() {
        let registry = OperationRegistry::new();

        let (_, receiver) = registry.register().await;

        assert!(!OperationRegistry::is_cancelled(&receiver));
    }

    #[tokio::test]
    async fn test_cancel_sets_cancelled_state() {
        let registry = OperationRegistry::new();

        let (operation_id, receiver) = registry.register().await;

        let result = registry.cancel(&operation_id).await;

        assert!(result);
        assert!(OperationRegistry::is_cancelled(&receiver));
    }

    #[tokio::test]
    async fn test_cancel_nonexistent_returns_false() {
        let registry = OperationRegistry::new();

        let result = registry.cancel("nonexistent-id").await;

        assert!(!result);
    }

    #[tokio::test]
    async fn test_complete_removes_operation() {
        let registry = OperationRegistry::new();

        let (operation_id, _) = registry.register().await;
        assert!(registry.has_operation(&operation_id).await);

        registry.complete(&operation_id).await;

        assert!(!registry.has_operation(&operation_id).await);
    }

    #[tokio::test]
    async fn test_operation_count() {
        let registry = OperationRegistry::new();

        assert_eq!(registry.operation_count().await, 0);

        let (id1, _) = registry.register().await;
        assert_eq!(registry.operation_count().await, 1);

        let (id2, _) = registry.register().await;
        assert_eq!(registry.operation_count().await, 2);

        registry.complete(&id1).await;
        assert_eq!(registry.operation_count().await, 1);

        registry.complete(&id2).await;
        assert_eq!(registry.operation_count().await, 0);
    }

    #[tokio::test]
    async fn test_clone_shares_state() {
        let registry1 = OperationRegistry::new();
        let registry2 = registry1.clone();

        let (operation_id, receiver) = registry1.register().await;

        // Cancel using cloned registry
        let result = registry2.cancel(&operation_id).await;

        assert!(result);
        assert!(OperationRegistry::is_cancelled(&receiver));
    }

    #[tokio::test]
    async fn test_default_impl() {
        let registry = OperationRegistry::default();

        assert_eq!(registry.operation_count().await, 0);
    }

    #[tokio::test]
    async fn test_is_cancelled_checks_receiver_borrow() {
        let registry = OperationRegistry::new();
        let (operation_id, receiver) = registry.register().await;

        // Initial borrow should be false
        assert_eq!(*receiver.borrow(), false);
        assert!(!OperationRegistry::is_cancelled(&receiver));

        // After cancellation, borrow should be true
        registry.cancel(&operation_id).await;
        assert_eq!(*receiver.borrow(), true);
        assert!(OperationRegistry::is_cancelled(&receiver));
    }

    #[tokio::test]
    async fn test_multiple_operations_independent() {
        let registry = OperationRegistry::new();

        let (id1, receiver1) = registry.register().await;
        let (id2, receiver2) = registry.register().await;
        let (_id3, receiver3) = registry.register().await;

        // Cancel only operation 2
        registry.cancel(&id2).await;

        // Only receiver2 should be cancelled
        assert!(!OperationRegistry::is_cancelled(&receiver1));
        assert!(OperationRegistry::is_cancelled(&receiver2));
        assert!(!OperationRegistry::is_cancelled(&receiver3));

        // Cancel operation 1
        registry.cancel(&id1).await;
        assert!(OperationRegistry::is_cancelled(&receiver1));
        assert!(!OperationRegistry::is_cancelled(&receiver3));
    }

    #[tokio::test]
    async fn test_complete_idempotent() {
        let registry = OperationRegistry::new();
        let (operation_id, _) = registry.register().await;

        // Complete the same operation multiple times should not panic
        registry.complete(&operation_id).await;
        registry.complete(&operation_id).await;
        registry.complete(&operation_id).await;

        assert_eq!(registry.operation_count().await, 0);
    }

    #[tokio::test]
    async fn test_cancel_after_complete() {
        let registry = OperationRegistry::new();
        let (operation_id, _) = registry.register().await;

        registry.complete(&operation_id).await;

        // Cancel should return false for completed/removed operation
        let result = registry.cancel(&operation_id).await;
        assert!(!result);
    }

    #[tokio::test]
    async fn test_has_operation() {
        let registry = OperationRegistry::new();

        assert!(!registry.has_operation("nonexistent").await);

        let (operation_id, _) = registry.register().await;
        assert!(registry.has_operation(&operation_id).await);

        registry.complete(&operation_id).await;
        assert!(!registry.has_operation(&operation_id).await);
    }
}
