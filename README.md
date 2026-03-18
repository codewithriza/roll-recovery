

#  Roll Recovery

### TSBIE Auth Vulnerability PoC — Security Research Tool

> An open-source security research tool that demonstrates critical authentication vulnerabilities on the TSBIE student portal — featuring automated DOB enumeration, real-time activity logging, and a modern research-grade interface

[🚀 Quick Start](#-quick-start) · [📖 Documentation](#-how-it-works) · [🔒 Vulnerability Details](#-vulnerability-disclosure) · [🤝 Contributing](#-contributing)

</div>

---

> [!WARNING]
> **Responsible Use Only:** This tool is intended exclusively for authorized security research, personal data recovery, and educational demonstration of authentication vulnerabilities. Unauthorized use to access third-party data without consent may violate applicable laws including the **IT Act, 2000 (India)**. The author assumes no liability for misuse.

---



> [\!IMPORTANT]
>
> ### 🚨 Vulnerability Disclosure Status: **Reported**
>
> This repository documents critical authentication flaws and tracks the implementation of necessary security patches.
>
> | Authority | Date Reported | Status |
> | :--- | :--- | :--- |
> | **TSBIE (Telangana State Board)** | **March 14, 2026** | ⏳ Awaiting Response / Patch |
>
> *This documentation is maintained for educational purposes and to advocate for stronger PII protection on Indian government portals.*

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Vulnerability Disclosure](#-vulnerability-disclosure)
- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Data Exposed](#-data-exposed)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

**Roll Recovery** is an open-source security research tool that demonstrates a **critical authentication vulnerability** on the TSBIE (Telangana State Board of Intermediate Education) student portal.

The portal protects sensitive student records using only a **Date of Birth** as a secondary authentication factor. Because the portal lacks **rate-limiting**, **CAPTCHA**, and **account lockout**, this information can be recovered in minutes through automated form submission.

This project serves as a **responsible disclosure** and a call-to-action for better security practices on government infrastructure.

### Why This Matters

```
🔓 No rate limiting     → Unlimited automated requests
🔓 No CAPTCHA           → Zero bot protection  
🔓 No account lockout   → Infinite retry attempts
🔓 DOB-only auth        → Low-entropy, easily enumerable
🔓 No OTP verification  → No secondary validation
```

---

## ✨ Key Features

| Feature | Description |
|:--------|:------------|
| 🔐 **Authorization Gate** | Users must accept terms and confirm authorization before accessing the tool |
| 🎨 **Modern UI** | Clean, research-grade interface with ambient effects and smooth animations |
| 📊 **Real-time Dashboard** | Live progress tracking with request count, coverage %, and elapsed time |
| 📝 **Activity Log** | Terminal-style log showing every request and response in real-time |
| ⚡ **Dual Mode** | SSE streaming (localhost) + polling (Vercel serverless) |
| 📥 **Download & Preview** | Download recovered hall tickets or preview them inline |
| 📱 **Fully Responsive** | Works flawlessly on desktop, tablet, and mobile |
| 🎯 **Configurable Delay** | Adjustable request interval from 0ms to 5000ms |
| 🔄 **New Scan** | Quick reset to start a fresh audit without page reload |

---

## 🔒 Vulnerability Disclosure

<table>
<thead>
<tr>
<th>Parameter</th>
<th>Current State</th>
<th>Recommended</th>
<th>Severity</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Rate Limiting</strong></td>
<td>❌ None</td>
<td>✅ ≤ 5 req/min per IP</td>
<td>🔴 Critical</td>
</tr>
<tr>
<td><strong>CAPTCHA</strong></td>
<td>❌ Absent</td>
<td>✅ reCAPTCHA v3</td>
<td>🔴 Critical</td>
</tr>
<tr>
<td><strong>Account Lockout</strong></td>
<td>❌ Not implemented</td>
<td>✅ Lock after 5 failures</td>
<td>🟠 High</td>
</tr>
<tr>
<td><strong>OTP Verification</strong></td>
<td>❌ Not required</td>
<td>✅ SMS / Email OTP</td>
<td>🟠 High</td>
</tr>
<tr>
<td><strong>Auth Factor</strong></td>
<td>❌ DOB only (low entropy)</td>
<td>✅ Multi-factor auth</td>
<td>🟠 High</td>
</tr>
<tr>
<td><strong>Request Throttling</strong></td>
<td>❌ No server-side throttle</td>
<td>✅ Exponential back-off</td>
<td>🟡 Medium</td>
</tr>
</tbody>
</table>

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) **v18+**
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/codewithriza/roll-recovery.git

# Navigate to the project
cd roll-recovery

# Install dependencies
npm install
```

### Run

```bash
# Start the server
npm start

# Or with a custom port
PORT=8080 npm start
```

Open **http://localhost:3000** in your browser.

### Usage

1. ✅ **Accept the authorization terms** in the confirmation modal
2. 🔢 Enter the **10-digit TSBIE roll number**
3. 📅 Set the approximate **DOB range** (default: 2008–2009)
4. ⏱️ Adjust the **request interval** — 0ms demonstrates zero server throttling
5. 🚀 Click **Launch Scan** to begin the automated recovery audit
6. 📥 **Download** or **preview** the recovered hall ticket

---

## 📖 How It Works

```
Step 01 ─── Identify the Target
             │
             │  Provide the 10-digit TSBIE roll number
             │  for the record to be audited.
             ▼
Step 02 ─── Define Enumeration Range
             │
             │  Set the DOB range to test. 2008–2009
             │  covers the majority of current Inter students.
             ▼
Step 03 ─── Execute Latency Test
             │
             │  The tool submits automated requests to the portal.
             │  Setting delay to 0ms demonstrates the complete
             │  absence of server-side throttling.
             ▼
Step 04 ─── Retrieve the Record
             
             On a successful match, the full hall ticket
             is returned — confirming the vulnerability
             is exploitable.
```

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                  │     │                  │     │                 │
│   Browser (UI)  │────▶│  Express Server  │────▶│  TSBIE Portal   │
│                  │     │                  │     │                 │
│  • Modern UI    │     │  • Puppeteer     │     │  • No Rate Limit│
│  • Auth Gate    │◀────│  • SSE Stream    │◀────│  • DOB-only Auth│
│  • Activity Log │     │  • Request Queue │     │  • No CAPTCHA   │
│                  │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        ▲                                                │
        └────────── Real-time Activity Log ◀─────────────┘
```

### Tech Stack

| Component | Technology | Purpose |
|:----------|:-----------|:--------|
| **Backend** | Node.js, Express | API server & request routing |
| **Automation** | Puppeteer (Headless Chrome) | Browser automation for form submission |
| **Streaming** | Server-Sent Events (SSE) | Real-time progress updates |
| **Frontend** | Vanilla JS, CSS3, HTML5 | Zero-dependency UI |
| **Deployment** | Vercel (static) + VPS (backend) | Hybrid deployment model |

---

## 🗃️ Data Exposed

A successful audit retrieves the following **PII** from the portal:

| Data Field | Type | Risk Level |
|:-----------|:-----|:-----------|
| Full Name | Text | 🟠 High |
| Father's Name | Text | 🟠 High |
| Mother's Name | Text | 🟠 High |
| Date of Birth | Date | 🔴 Critical |
| Photograph | Image | 🔴 Critical |
| Signature | Image | 🔴 Critical |
| College Name | Text | 🟡 Medium |
| Exam Center | Text | 🟡 Medium |
| Subjects | Text | 🟢 Low |
| Exam Schedule | Text | 🟢 Low |

---

## 🌐 Deployment

### Local / VPS

```bash
# Standard
npm start

# Custom port
PORT=8080 npm start

# With PM2 (production)
pm2 start server.js --name roll-recovery
```

### Vercel

> [!NOTE]
> Full scan functionality requires Puppeteer (headless Chrome). Vercel serves the static frontend; the scanning backend should run on a VPS or local machine.

```bash
# Deploy to Vercel
vercel --prod
```

### Docker (Coming Soon)

```bash
# Build
docker build -t roll-recovery .

# Run
docker run -p 3000:3000 roll-recovery
```

---

## 🔧 Troubleshooting

<details>
<summary><strong>Port already in use</strong></summary>

```bash
PORT=4000 npm start
```

Or kill the process using the port:
```bash
lsof -ti:3000 | xargs kill -9
```
</details>

<details>
<summary><strong>Puppeteer won't launch</strong></summary>

```bash
npx puppeteer browsers install chrome
```

On Linux, you may need additional dependencies:
```bash
sudo apt-get install -y libgbm-dev libnss3 libatk-bridge2.0-0
```
</details>

<details>
<summary><strong>TSBIE portal is down</strong></summary>

The portal goes down occasionally for maintenance. Check the portal status at [tgbieht.cgg.gov.in](https://tgbieht.cgg.gov.in) and retry later.
</details>

<details>
<summary><strong>No match found</strong></summary>

- Expand the date range (try 2007–2010)
- Verify the roll number is correct and 10 digits
- Most current Inter students are born 2008–2009
</details>

<details>
<summary><strong>Connection lost mid-scan</strong></summary>

- Narrow the date range
- Increase the request interval to 500ms+
- Check your internet connection
</details>

---

## 🤝 Contributing

Contributions that improve the security research aspect are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

### Roadmap

- [ ] 🎯 Support for 1st Year / Supplementary records
- [ ] 🐳 Dockerized environment for easier setup
- [ ] 📊 Export results to structured JSON / CSV
- [ ] 🔄 Proxy rotation support for extended audits
- [ ] 📈 Analytics dashboard for scan statistics
- [ ] 🧪 Automated test suite
- [ ] 📱 PWA support for mobile

### How to Contribute

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

### ⭐ Star this repo if you found it useful!

<br>

Built with 🖤 by [@codewithriza](https://github.com/codewithriza)

[Report Bug](https://github.com/codewithriza/roll-recovery/issues) · [Request Feature](https://github.com/codewithriza/roll-recovery/issues) · [View on GitHub](https://github.com/codewithriza/roll-recovery)

<br>

<sub>For authorized security research and data recovery only. Misuse is prohibited.</sub>

</div>
