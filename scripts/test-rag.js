/**
 * RAG System Test Script
 * Tests the embedding and vector search functionality
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from '@xenova/transformers'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cosine similarity function (same as Rust)
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

  if (magnitudeA === 0 || magnitudeB === 0) return 0

  return dotProduct / (magnitudeA * magnitudeB)
}

// Convert buffer to float32 array
function bufferToFloat32Array(buffer) {
  const floats = []
  for (let i = 0; i < buffer.length; i += 4) {
    const bytes = [buffer[i], buffer[i + 1], buffer[i + 2], buffer[i + 3]]
    const float = new Float32Array(new Uint8Array(bytes).buffer)[0]
    floats.push(float)
  }
  return floats
}

async function testRAG() {
  console.log('🧪 RAG System Test\n')
  console.log('═'.repeat(60))

  // Load embedding model
  console.log('\n📦 Loading embedding model...')
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  console.log('✅ Model loaded\n')

  // Open database
  const dbPath = path.join(__dirname, '../src-tauri/resources/embeddings/examples.db')
  console.log(`📂 Opening database: ${dbPath}`)
  const db = new Database(dbPath, { readonly: true })

  // Check database contents
  const count = db.prepare('SELECT COUNT(*) as count FROM example_scripts').get()
  console.log(`✅ Found ${count.count} examples in database\n`)

  // Test query - similar to business presentation
  const testQuery = `
    Good afternoon everyone. I'm excited to share our quarterly results with you today.
    We've had tremendous success this quarter, with revenue reaching record levels.
    Our team has worked incredibly hard to achieve these results.
  `

  console.log('🔍 Test Query:')
  console.log(testQuery.trim())
  console.log('\n' + '═'.repeat(60))

  // Generate embedding for test query
  console.log('\n🔄 Generating query embedding...')
  const queryOutput = await embedder(testQuery, {
    pooling: 'mean',
    normalize: true
  })
  const queryEmbedding = Array.from(queryOutput.data)
  console.log(`✅ Query embedding generated (${queryEmbedding.length} dimensions)\n`)

  // Fetch all examples and calculate similarities
  console.log('🔍 Searching for similar examples...\n')

  const examples = db
    .prepare(
      `
    SELECT e.script_id, s.title, s.category, s.before_text, e.embedding
    FROM embeddings e
    JOIN example_scripts s ON e.script_id = s.id
    ORDER BY s.quality_score DESC
  `
    )
    .all()

  const results = []

  for (const example of examples) {
    const exampleEmbedding = bufferToFloat32Array(example.embedding)
    const similarity = cosineSimilarity(queryEmbedding, exampleEmbedding)

    results.push({
      id: example.script_id,
      title: example.title,
      category: example.category,
      similarity,
      preview: example.before_text.substring(0, 100) + '...'
    })
  }

  // Sort by similarity
  results.sort((a, b) => b.similarity - a.similarity)

  // Display results
  console.log('📊 Search Results:\n')
  results.forEach((result, i) => {
    const percentage = (result.similarity * 100).toFixed(1)
    const passesThreshold = result.similarity >= 0.65 ? '✅' : '❌'

    console.log(`${i + 1}. ${passesThreshold} ${result.title}`)
    console.log(`   Category: ${result.category}`)
    console.log(
      `   Similarity: ${percentage}% ${result.similarity >= 0.65 ? '(PASS)' : '(FAIL - below 65% threshold)'}`
    )
    console.log(`   Preview: ${result.preview}`)
    console.log('')
  })

  console.log('═'.repeat(60))

  // Summary
  const passing = results.filter(r => r.similarity >= 0.65).length
  console.log(`\n📈 Summary:`)
  console.log(`   Total examples: ${results.length}`)
  console.log(`   Passing threshold (≥65%): ${passing}`)
  console.log(`   Failing threshold (<65%): ${results.length - passing}`)

  if (passing > 0) {
    console.log(`\n✅ RAG system is working! Found ${passing} relevant example(s)`)
  } else {
    console.log(`\n⚠️  No examples passed similarity threshold`)
    console.log(`   This is normal if query is very different from examples`)
  }

  db.close()
  console.log('\n✨ Test complete!\n')
}

testRAG().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
