/**
 * Build-Time Embedding Generator
 * Generates embeddings for example scripts and stores them in SQLite database
 * Run this before building the Tauri app
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from '@huggingface/transformers'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function embedExamples() {
  console.log('🚀 Starting example embedding process...\n')

  // Load embedding model
  console.log('📦 Loading embedding model (Xenova/all-MiniLM-L6-v2)...')
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  console.log('✅ Model loaded successfully\n')

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

      // Generate embedding
      console.log(`   🔄 Generating embedding...`)
      const output = await embedder(before, {
        pooling: 'mean',
        normalize: true
      })
      const embedding = Array.from(output.data)
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
        JSON.stringify(metadata.tags),
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
  const dbSize = fs.statSync(dbPath).size

  console.log('═══════════════════════════════════════')
  console.log('📊 Embedding Summary')
  console.log('═══════════════════════════════════════')
  console.log(`✅ Successfully processed: ${successCount}`)
  console.log(`❌ Errors: ${errorCount}`)
  console.log(`💾 Total examples in DB: ${stats.count}`)
  console.log(`📦 Database size: ${(dbSize / 1024).toFixed(2)} KB`)
  console.log('═══════════════════════════════════════\n')

  db.close()
  console.log('✨ Embedding process complete!\n')
}

embedExamples().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
