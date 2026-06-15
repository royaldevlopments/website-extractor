# 🌐 Website Extractor

> **Download complete websites with all assets — powered by `wget --mirror`**

Extract entire websites (HTML, CSS, JS, images, fonts) into a single ZIP file. Built by **Royal Devlopments**.

![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![Wget](https://img.shields.io/badge/wget-1.21-FF6600?logo=gnu&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?logo=open-source-initiative&logoColor=white)

---

## ✨ Features

- **Full Site Download** — Downloads HTML, CSS, JS, images, fonts, and all linked assets
- **Multi-Tab Interface** — Extract multiple websites simultaneously in separate tabs
- **Live Progress** — Real-time wget output with progress bars and file-by-file status
- **ZIP Export** — Everything packaged into a single downloadable ZIP file
- **No API Key Required** — Works with any public website, no registration needed
- **Async Processing** — Extraction runs in background; you can start new jobs while others run
- **Hardcoded Branding** — Server-side watermark; cannot be removed from frontend

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18 or later
- **wget** installed on your system (`apt install wget` / `brew install wget` / `choco install wget`)
- 1 GB+ free disk space (for large sites)

### Setup

```bash
# Clone the repository
git clone https://github.com/royaldevlopments/website-extractor.git
cd website-extractor

# Install dependencies
npm install

# Start the server
npm start
```

Server runs on **http://localhost:3000** by default.

### Custom Port

```bash
PORT=3005 npm start
```

### Run on a VPS

```bash
PORT=3005 HOST=0.0.0.0 nohup node server.js > server.log 2>&1 &
```

## 📦 Full Setup Guide

### 📱 Termux (Android)

```bash
# 1. Update packages
pkg update && pkg upgrade -y

# 2. Install Node.js & wget
pkg install nodejs wget git -y

# 3. Clone the repo
git clone https://github.com/royaldevlopments/website-extractor.git
cd website-extractor

# 4. Install dependencies
npm install

# 5. Start server (runs on port 3000 by default)
npm start
```

Open `http://localhost:3000` in your mobile browser.

> **Run in background (Termux):**
> Append `&` or use `tmux`:
> ```bash
> pkg install tmux -y
> tmux new -s extract
> npm start
> # Ctrl+B then D to detach
> # tmux attach -t extract to come back
> ```

> **Run on a different port:**
> ```bash
> PORT=3005 npm start
> ```

---

### 🪟 Windows PowerShell

#### Step 1 — Install Node.js
```powershell
# Download & install Node.js LTS (includes npm)
# Go to https://nodejs.org and download the LTS installer
# Run the installer — make sure "Add to PATH" is checked
```

Verify installation:
```powershell
node --version
npm --version
```

#### Step 2 — Install wget
**Option A — via winget (recommended):**
```powershell
winget install --id GNU.Wget2
```

**Option B — manual download:**
1. Download wget from: https://eternallybored.org/misc/wget/
2. Extract `wget.exe` to `C:\Windows\System32\`

Verify:
```powershell
wget --version
```

#### Step 3 — Clone & Setup
```powershell
# Clone the repo
git clone https://github.com/royaldevlopments/website-extractor.git
cd website-extractor

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3000` in your browser.

> **Run in background (PowerShell):**
> ```powershell
> Start-Process -NoNewWindow node "server.js"
> ```
> Or use the `START` command:
> ```cmd
> start /B node server.js
> ```

> **Run on a custom port:**
> ```powershell
> $env:PORT=3005; node server.js
> ```

---

## 🖥 Usage

1. Open `http://your-server:3005` in your browser
2. Click **+ New Tab** to add an extraction tab
3. Enter a URL (e.g., `https://example.com`)
4. Click **Extract 🔍**
5. Watch live progress with real-time wget output
6. Click **Download ZIP** when done

> Supports multiple tabs — extract different sites in parallel.

---

## 🧱 Architecture

```
website-extractor/
├── server.js          # Express server (all routes, HTML templates)
├── lib/
│   └── extractor.js   # wget spawn, job management, file walking
├── public/
│   └── index.html     # Multi-tab frontend
├── package.json
└── README.md
```

### API Endpoints

| Method | Endpoint                | Description                        |
|--------|-------------------------|------------------------------------|
| GET    | `/`                     | Main multi-tab UI                  |
| GET    | `/api/start?url=`       | Start async extraction → jobId     |
| GET    | `/api/status/:jobId`    | Poll extraction status + live log  |
| GET    | `/api/result/:jobId`    | HTML result page with download     |
| GET    | `/api/download/:jobId`  | Download ZIP archive               |
| POST   | `/api/extract`          | Sync extraction (legacy)           |
| GET    | `/extract?url=`         | Form-based extraction page         |

---

## 🛠 Tech Stack

| Language/Tool    | Usage                        |
|------------------|------------------------------|
| **Node.js**      | Runtime                      |
| **Express**      | Web server & routing         |
| **JavaScript**   | Frontend (vanilla, no framework) |
| **HTML5/CSS3**   | UI (dark theme, responsive)  |
| **wget**         | Site mirroring engine        |
| **archiver**     | ZIP packaging                |
| **helmet**       | HTTP security headers        |

---

## 📄 License

MIT License — see [LICENSE](LICENSE).

```
MIT License

Copyright (c) 2026 Royal Devlopments

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">
  <strong>✦ Royal Devlopments ✦</strong>
  <br>
  <sub>We build websites, apps, APIs & tools. Shipping quality since day one.</sub>
</div>
