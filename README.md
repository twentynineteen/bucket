<!-- ⚠️ This README has been generated from the file(s) "blueprint.md" ⚠️--><h1 align="center">bucket</h1>

<p align="center">
  <b>A desktop video editing workflow application that streamlines video ingest, project creation, and integrates with professional video production tools.</b></br>
  <sub><sub>
</p>

<br />



[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#table-of-contents)

## ➤ Table of Contents

* [➤ Overview](#-overview)
* [➤ Key Features](#-key-features)
* [➤ Installation](#-installation)
	* [Prerequisites](#prerequisites)
	* [Quick Start](#quick-start)
	* [Development Setup](#development-setup)
* [➤ Ollama Setup](#-ollama-setup)
	* [Installing Ollama](#installing-ollama)
	* [Running Ollama](#running-ollama)
	* [Installing AI Models](#installing-ai-models)
	* [Configuring in Bucket](#configuring-in-bucket)
	* [Troubleshooting Ollama](#troubleshooting-ollama)
* [➤ How It Works](#-how-it-works)
	* [AI Script Formatter Workflow](#ai-script-formatter-workflow)
	* [Video Project Workflow](#video-project-workflow)
* [➤ Tech Stack](#-tech-stack)
* [➤ Premiere Pro Plugin Management](#-premiere-pro-plugin-management)
	* [Bundled Plugins](#bundled-plugins)
		* [BreadcrumbsPremiere](#breadcrumbspremiere)
		* [Boring](#boring)
	* [One-Click Installation](#one-click-installation)
	* [Platform Support](#platform-support)
* [➤ License](#-license)

[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#overview)

## ➤ Overview

Bucket is a powerful desktop application built with Tauri (Rust + React/TypeScript) designed to streamline video editing workflows for professionals. It simplifies video file ingest, automates project creation, and seamlessly integrates with industry-standard tools like Adobe Premiere, Trello, and Sprout Video.


[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#key-features)

## ➤ Key Features

- **AI Script Formatter**: AI-powered autocue script formatting using locally hosted LLM models
  - Upload Word documents (.docx) and format them for teleprompter use
  - Text editor to review and update AI changes
  - Edit and refine AI suggestions before exporting
  - Powered by local Ollama models (no cloud required)
- **Multi-Camera Project Setup**: Organize footage by camera assignment for multi-camera shoots
- **Adobe Premiere Integration**: Automatically generate project templates and folder structures
- **Progress Tracking**: Real-time progress bars for file operations and project creation
- **External Tool Integration**:
  - **Trello**: Project management and card updates
  - **Sprout Video**: Video hosting with custom posterframe generation
- **Secure User Management**: Login/registration with encrypted data storage
- **Cross-Platform**: Available for Windows, macOS, and Linux


[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#installation)

## ➤ Installation

### Prerequisites

- Bun (package manager)
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


[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#ollama-setup)

## ➤ Ollama Setup

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


[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#how-it-works)

## ➤ How It Works

### AI Script Formatter Workflow

1. **Upload Script**: Select a `.docx` file from your computer (up to 1GB)
2. **Select AI Model**: Choose from available Ollama models running on your machine
3. **AI Processing**: The script is automatically formatted for autocue/teleprompter readability
4. **Review Changes**: View side-by-side diff showing original vs. AI-formatted text
5. **Edit & Refine**: Make manual adjustments to the AI's suggestions if needed
6. **Export**: Download the formatted script as a `.docx` file ready for teleprompter use

### Video Project Workflow

1. **Select Video Files**: Choose footage files from your file system
2. **Assign Cameras**: Organize files by camera number for multi-camera projects
3. **Configure Project**: Set project title and output folder location
4. **Create Project**: Generate organized folder structure with Adobe Premiere integration
5. **Track Progress**: Monitor file operations with real-time progress updates
6. **Integrate & Upload**: Connect with Trello for project management or Sprout Video for hosting


[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#tech-stack)

## ➤ Tech Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Backend**: Tauri 2.0 (Rust)
- **UI Components**: Radix UI + Lucide icons
- **State Management**: Zustand + TanStack React Query
- **Build Tool**: Vite
- **AI Integration**:
  - Vercel AI SDK v5 for unified provider interface
  - Ollama (local LLM runtime)
  - Monaco Editor for diff visualization and editing
  - mammoth.js for Word document parsing
  - docx for document generation


[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#premiere-pro-plugin-management)

## ➤ Premiere Pro Plugin Management

Bucket includes an **integrated plugin manager** for Premiere Pro CEP extensions. Install and update plugins with one click - no manual file operations required.

### Bundled Plugins

#### BreadcrumbsPremiere

Metadata management panel that syncs with Bucket's project system. View and edit breadcrumbs directly in your Premiere timeline.

**Features**:

- View and edit project metadata in Premiere Pro
- Sync with Trello cards and Sprout Video
- Quick access to project resources
- Seamless integration with Bucket workflows

#### Boring

Premiere Pro extension for streamlined workflows.

**Features**:

- _(User to specify features)_

### One-Click Installation

1. Navigate to **Upload Content > Premiere Plugin Manager**
2. Click **Install** on any plugin
3. Restart Premiere Pro
4. Access via **Window > Extensions**

### Platform Support

- **macOS**: Automatic debug mode configuration
- **Windows**: Silent installation
- **Cross-platform**: Works identically on both platforms

[Read full documentation →](../PREMIERE_PLUGINS.md)


[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/cloudy.png)](#license)

## ➤ License
	
Licensed under [UNLICENSED](https://opensource.org/licenses/UNLICENSED).
