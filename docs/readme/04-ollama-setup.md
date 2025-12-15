## Ollama Setup

The AI Script Formatter feature requires Ollama to be installed and running locally.

### Installing Ollama

1. Download and install Ollama from [ollama.com](https://ollama.com)
   - **macOS**: Download the `.dmg` installer
   - **Linux**: Run `curl -fsSL https://ollama.com/install.sh | sh`
   - **Windows**: Download from the Ollama website

2. Verify installation:
   ```bash
   ollama --version
   ```

### Running Ollama

Ollama runs as a background service. To start it:

```bash
ollama serve
```

The service runs on `http://localhost:11434` by default.

### Installing AI Models

Before using the Script Formatter, download the following language models:

```bash

ollama pull llama3.1:latest
ollama pull nomic-embed-text:latest
ollama list
```

**Model Selection Tips:**

- **llama3.2**: Best for quick formatting on limited hardware

### Configuring in Bucket

1. Launch Bucket and navigate to **Settings**
2. Find the **Ollama URL** field (default: `http://localhost:11434`)
3. Update the URL if needed and click **Save**
4. Click **Test Connection** to verify Ollama is running and see how many models are available
5. Navigate to **AI Tools > Script Formatter** to start formatting scripts

### Troubleshooting Ollama

**Connection Failed:**
Check if Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

If not running, start it:

```bash
ollama serve
```

**No Models Available:**
List installed models:

```bash
ollama list
```

Install a model:

```bash
ollama pull llama3:latest
```

**Port Conflicts:**
If port 11434 is in use, you can run Ollama on a different port:

```bash
OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

Then update the URL in Bucket Settings to `http://localhost:11435`
