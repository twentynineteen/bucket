## Installation

### Prerequisites

- Node.js (npm) or Bun
- Rust (for development)
- **Ollama** (for AI Script Formatter feature) - see [Ollama Setup](#ollama-setup) below

### Quick Start

1. Clone the repository:

   ```bash
   git clone https://github.com/twentynineteen/bucket.git
   cd bucket
   ```

2. Install dependencies:

   ```bash
   bun install
   # or
   npm install
   ```

3. Build the application:

   ```bash
   npm run build:tauri
   ```

4. On macOS, open the DMG file in `/target/build/dmg` and copy the app to your Applications folder.

### Development Setup

To run in development mode:

```bash
npm run dev:tauri
```
