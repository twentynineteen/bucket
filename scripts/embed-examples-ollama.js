/**
 * Build-Time Embedding Generator (Ollama Version)
 * Generates embeddings for example scripts using Ollama and stores them in SQLite database
 * Requires: ollama running locally with nomic-embed-text model installed
 * Run: npm run embed:examples:ollama
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Skip embedding generation in CI environments
if (process.env.CI) {
  console.log('⏭️  Skipping embedding generation in CI environment')
  console.log('   Pre-built examples.db should be committed to the repository\n')
  process.exit(0)
}

const OLLAMA_BASE_URL = 'http://localhost:11434'
const EMBEDDING_MODEL = 'nomic-embed-text'

async function checkOllamaAvailability() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error('Ollama is not running')
    }

    const data = await response.json()
    const models = data.models || []

    const hasModel = models.some(m => m.name.includes(EMBEDDING_MODEL))
    if (!hasModel) {
      throw new Error(
        `Model "${EMBEDDING_MODEL}" not found. Run: ollama pull ${EMBEDDING_MODEL}`
      )
    }

    return true
  } catch (error) {
    throw new Error(`Ollama check failed: ${error.message}`)
  }
}

async function generateEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text
    }),
    signal: AbortSignal.timeout(30000)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error('Invalid response from Ollama: missing embedding array')
  }

  return data.embedding
}

async function embedExamples() {
  console.log('🚀 Starting example embedding process (Ollama)...\n')

  // Check Ollama availability
  console.log(`🔍 Checking Ollama at ${OLLAMA_BASE_URL}...`)
  try {
    await checkOllamaAvailability()
    console.log(`✅ Ollama is running with ${EMBEDDING_MODEL} model\n`)
  } catch (error) {
    console.error(`❌ ${error.message}`)
    console.error('\nPlease ensure:')
    console.error('1. Ollama is running (ollama serve)')
    console.error(`2. Model is installed (ollama pull ${EMBEDDING_MODEL})\n`)
    process.exit(1)
  }

  // Create/open database
  const dbPath = path.join(__dirname, '../src-tauri/resources/embeddings/examples.db')
  const db = new Database(dbPath)

  console.log(`📂 Database: ${dbPath}\n`)

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS example_scripts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      before_text TEXT NOT NULL,
      after_text TEXT NOT NULL,
      tags TEXT,
      word_count INTEGER,
      quality_score INTEGER,
      source TEXT DEFAULT 'bundled',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS embeddings (
      script_id TEXT PRIMARY KEY,
      embedding BLOB NOT NULL,
      dimension INTEGER NOT NULL,
      FOREIGN KEY(script_id) REFERENCES example_scripts(id)
    );

    CREATE TABLE IF NOT EXISTS db_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_category ON example_scripts(category);
    CREATE INDEX IF NOT EXISTS idx_quality ON example_scripts(quality_score);
    CREATE INDEX IF NOT EXISTS idx_source ON example_scripts(source);
  `)

  console.log('✅ Database tables created\n')

  // Clear existing data
  db.exec('DELETE FROM embeddings')
  db.exec('DELETE FROM example_scripts')
  console.log('🧹 Cleared existing data\n')

  const examplesDir = path.join(__dirname, '../src-tauri/resources/examples')
  const examples = fs.readdirSync(examplesDir)

  let successCount = 0
  let errorCount = 0

  for (const exampleDir of examples) {
    const examplePath = path.join(examplesDir, exampleDir)

    // Skip if not a directory
    if (!fs.statSync(examplePath).isDirectory()) continue

    try {
      console.log(`📝 Processing: ${exampleDir}`)

      // Read files
      const beforePath = path.join(examplePath, 'before.txt')
      const afterPath = path.join(examplePath, 'after.txt')
      const metadataPath = path.join(examplePath, 'metadata.json')

      if (
        !fs.existsSync(beforePath) ||
        !fs.existsSync(afterPath) ||
        !fs.existsSync(metadataPath)
      ) {
        console.log(`   ⚠️  Skipping (missing files)\n`)
        errorCount++
        continue
      }

      const before = fs.readFileSync(beforePath, 'utf-8')
      const after = fs.readFileSync(afterPath, 'utf-8')
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))

      // Generate embedding using Ollama - use AFTER text for formatting pattern matching
      console.log(
        `   🔄 Generating embedding with Ollama (from formatted 'after' text)...`
      )
      const embedding = await generateEmbedding(after)
      console.log(`   ✅ Embedding generated (${embedding.length} dimensions)`)

      // Insert into database
      const insertScript = db.prepare(`
        INSERT INTO example_scripts (id, title, category, before_text, after_text, tags, word_count, quality_score, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      insertScript.run(
        metadata.id,
        metadata.title,
        metadata.category,
        before,
        after,
        metadata.tags ? metadata.tags.join(',') : '',
        before.split(/\s+/).length,
        metadata.qualityScore,
        'bundled'
      )

      // Store embedding as binary
      const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer)
      const insertEmbedding = db.prepare(`
        INSERT INTO embeddings (script_id, embedding, dimension) VALUES (?, ?, ?)
      `)
      insertEmbedding.run(metadata.id, embeddingBuffer, embedding.length)

      console.log(`   💾 Saved to database`)
      console.log(`   📊 Word count: ${before.split(/\s+/).length}`)
      console.log(`   ⭐ Quality: ${metadata.qualityScore}/5\n`)

      successCount++
    } catch (error) {
      console.error(`   ❌ Error processing ${exampleDir}:`, error.message)
      console.log('')
      errorCount++
    }
  }

  // Print statistics
  const stats = db.prepare('SELECT COUNT(*) as count FROM example_scripts').get()
  const bundledCount = db
    .prepare("SELECT COUNT(*) as count FROM example_scripts WHERE source = 'bundled'")
    .get()
  const dbSize = fs.statSync(dbPath).size

  // Store metadata for version tracking and merge detection
  const timestamp = new Date().toISOString()
  db.prepare(
    `INSERT OR REPLACE INTO db_metadata (key, value, updated_at) VALUES (?, ?, ?)`
  ).run('bundled_version', timestamp, timestamp)

  db.prepare(
    `INSERT OR REPLACE INTO db_metadata (key, value, updated_at) VALUES (?, ?, ?)`
  ).run('bundled_count', bundledCount.count.toString(), timestamp)

  console.log('═══════════════════════════════════════')
  console.log('📊 Embedding Summary')
  console.log('═══════════════════════════════════════')
  console.log(`✅ Successfully processed: ${successCount}`)
  console.log(`❌ Errors: ${errorCount}`)
  console.log(`💾 Total examples in DB: ${stats.count}`)
  console.log(`📦 Bundled examples: ${bundledCount.count}`)
  console.log(`📦 Database size: ${(dbSize / 1024).toFixed(2)} KB`)
  console.log(`🔢 Embedding dimensions: 768 (nomic-embed-text)`)
  console.log(`🏷️  Version: ${timestamp}`)
  console.log('═══════════════════════════════════════\n')

  db.close()
  console.log('✨ Embedding process complete!\n')
}

embedExamples().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
