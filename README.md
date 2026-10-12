<p align="center">
  <img src="docs/en/ofis.png" width="860" alt="Ajan Ofisi: a live office for your Claude Code team">
</p>

<h1 align="center">Ajan Ofisi</h1>

<p align="center">
  A live office for your Claude Code team. Name your agents, give them jobs and skills,<br>
  talk to the chief and watch the work happen. For macOS, Windows and Linux.
</p>

<p align="center">
  <a href="https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-mac-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download Ajan Ofisi for macOS" height="44"></a>
  <a href="https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-win-x64.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-0A64AD?style=for-the-badge" alt="Download Ajan Ofisi for Windows" height="44"></a>
  <a href="https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-linux-x86_64.AppImage"><img src="https://img.shields.io/badge/Download%20for%20Linux-2B2B2B?style=for-the-badge&logo=linux&logoColor=white" alt="Download Ajan Ofisi for Linux" height="44"></a>
</p>

<p align="center"><b>English</b> · <a href="README.tr.md">Türkçe</a></p>

---

## Features

- 🧠 **The brain:** your single contact. It has no body and you give it any name. It opens a floor for each project, proposes a chief and a team for every floor, talks to the floor chiefs and gives you one report. It can read its answers aloud (computer voice, ElevenLabs or OpenAI).
- ⚙️ **Claude or OpenAI:** the team runs on Claude Code or OpenAI Codex. The app finds what is installed and signed in, and you can change it in Settings. Subscription sign in or an encrypted API key.
- 🏢 **Floors:** every project is a floor with its own chief and team. Floors run at the same time. Chiefs coordinate on a strong model, team members work on a model that uses less.
- 💬 **Chat panel:** the chief's answers, questions and approval requests land in one place. No need to watch the terminal; answer from the panel.
- 🫶 **Personal floor:** its chief is the brain. Pick the people you want, like a health advisor, business coach, advertiser, designer or developer, and each gets a room. Talk one to one in private, attach PDFs and images, and export the chat as PDF or Markdown.
- 🌐 **Browser room:** WhatsApp Web, Telegram, Gmail, LinkedIn and other accounts open inside the app in their own persistent profiles. You sign in once and the app never sees your password. When the team uses these accounts, every click and typing comes to you for approval.
- 📱 **Test areas:** a Test tab for the project's test address, plus iOS Simulator and Android emulator tools. Agents read console errors too.
- 🐙 **Developer friendly:** open a floor from an existing folder, from scratch (with git and a GitHub repo) or by cloning from GitHub. Every project card shows branch, changes and open pull requests; pull, commit, push and new branch are one click. The browser has iPhone, iPad and Android modes and an error console.
- 📒 **Work log:** every request, handoff and open task is written down per floor. A new session starts from a short "where you left off" note.
- ✨ **Skills, rules and training:** ready skills, your own skills, company rules, and feedback that becomes a member's permanent rule.
- 💾 **Backup:** back up the whole company to one file and restore it on another computer.
- 🔔 **Notifications and permissions:** get notified when work is done or approval is needed. macOS permissions are asked once during setup.
- 🌍 **English and Turkish.**

Idle team members wander off to the coffee bar, the ping pong table or the game corner until the next job arrives.

<p align="center">
  <img src="docs/en/mola.png" width="400">
  <img src="docs/en/ekip.png" width="400">
  <img src="docs/en/defter.png" width="400">
  <img src="docs/en/skiller.png" width="400">
</p>

## Install

Requirements: [Claude Code](https://code.claude.com/docs/en/setup) and an account that includes it (Pro, Max, Team, Enterprise or Console). If Claude Code is missing, the app shows the install command on first launch.

### Option 1: Download (easiest)

| System | File |
| --- | --- |
| macOS, Apple Silicon | [AjanOfisi-mac-arm64.dmg](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-mac-arm64.dmg) |
| macOS, Intel | [AjanOfisi-mac-x64.dmg](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-mac-x64.dmg) |
| Windows | [AjanOfisi-win-x64.exe](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-win-x64.exe) |
| Linux | [AppImage](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-linux-x86_64.AppImage) or [deb](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-linux-amd64.deb) |

On macOS open the dmg and drag **Ajan Ofisi** into **Applications**. The app is signed and notarized by Apple, so it opens like any other app.

The Windows installer is not signed yet. If SmartScreen appears, choose **More info** and then **Run anyway**.

### Option 2: Run from source

Needs [Node.js](https://nodejs.org) 22 or later.

```bash
git clone https://github.com/sarp07/Ajan-Ofisi.git
cd Ajan-Ofisi
npm install
npm start
```

No terminal? Double click `Ac.command` on macOS or `Ac.bat` on Windows. On Linux run `./ac.sh`.

## First launch

1. Name your office and your chief, pick a language.
2. Pick your first team members from the ready made people, or choose **Skip for now** and add them later from the **Team** page.
3. Pick skills, or skip.
4. Add a project folder on the **Projects** page and press **Start** on the **Office** page.
5. The first time, Claude Code asks you to sign in and to trust the folder. Both happen in the terminal at the bottom of the window.

## How it works

Ajan Ofisi runs Claude Code inside the app. Each time a session opens, your company (team, rules, skills) is compiled into a Claude Code plugin and Claude Code starts with it in an embedded terminal. The office listens to Claude Code's own hook events on your machine and draws what is really happening.

## Privacy and security

- The app **never sees or stores** your Claude password or key. You sign in through Claude Code's own login step.
- Live events are received only on this computer (`127.0.0.1`) with a secret key that changes on every launch. No port is open to the outside.
- Nothing is written into your projects or into `~/.claude`. All data stays in the app's own data folder.
- The app never asks for or keeps passwords. Each linked account keeps its browser session in its own profile, and API keys are stored with the system's encrypted storage.
- The mode that skips every permission is not accepted. The starter rules require your approval for production database writes, deploys, payments and wallet operations.
- Skills are downloaded from their original repositories at a pinned version.

## Good to know

- Team mode uses Claude Code agent teams, which is an experimental Claude Code feature and uses more of your plan. You can turn it off in **Settings**.
- Floors run at the same time, each in its own session with its own work log.

## Where your data lives

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/Ajan Ofisi` |
| Windows | `%APPDATA%\Ajan Ofisi` |
| Linux | `~/.config/Ajan Ofisi` |

To uninstall, delete the app and this folder.

## Development

```bash
npm test              # state engine, company and project store, plugin compiler, skills, work log, texts
npm run yayin:mac     # signed and notarized dmg for Apple Silicon and Intel, uploaded to the GitHub release
npm run paket:win     # Windows installer
npm run paket:linux   # AppImage and deb
```

`npm run yayin:mac` needs a Developer ID certificate and a notary profile on the Mac, see the top of `betik/yayin-mac.sh`. The Windows and Linux installers are built by GitHub Actions: every tag that starts with `v` builds them and adds them to the release. After packaging, `paket/sonra.cjs` checks that only the app's own files went into the installer and stops the build otherwise.

| Folder | Contents |
| --- | --- |
| `main.js`, `preload.cjs` | Electron main process and the bridge to the interface |
| `cekirdek/` | Company store, plugin compiler, state engine, work log, skill manager |
| `arayuz/` | Office scene and pages (no framework, no bundler) |
| `katalog/` | The ready made skill list |

## License

[MIT](LICENSE) © solazan. Catalog skills are downloaded from their own repositories and keep their own licenses.
