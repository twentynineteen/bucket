// Components
/** Page for managing script example embeddings used in RAG-powered formatting */
export { ExampleEmbeddings } from './ExampleEmbeddings/components/ExampleEmbeddings'
/** Page for AI-powered autocue script formatting with provider selection */
export { default as ScriptFormatter } from './ScriptFormatter/components/ScriptFormatter'

// Hooks
/** Hook for managing script formatter UI state -- input, output, provider, progress */
export { useScriptFormatterState } from './ScriptFormatter/hooks/useScriptFormatterState'
/** Hook for CRUD operations on script example embeddings with source filtering */
export { useExampleManagement } from './ExampleEmbeddings/hooks/useExampleManagement'
/** Hook for uploading script files as new example embeddings */
export { useScriptFileUpload } from './ExampleEmbeddings/hooks/useScriptFileUpload'

