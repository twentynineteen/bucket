## Installation

### Prerequisites

- Bun (required package manager)
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
   ```

3. Build the application:

   ```bash
   bun run build:tauri
   ```

4. On macOS, open the DMG file in `/target/build/dmg` and copy the app to your Applications folder.

### Development Setup

To run in development mode:

```bash
bun run dev:tauri
```
