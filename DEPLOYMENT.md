# GitHub Pages Deployment Guide

## Your GitHub Pages URL
Once deployed, your app will be at:
**https://raewm.github.io/ocean-data-viewer/**

## Initial Setup (One-Time)

### 1. Create GitHub Repository
1. Go to https://github.com/new
2. Name it: `ocean-data-viewer`
3. Make it **Public** (required for free GitHub Pages)
4. Do NOT initialize with README (we already have code)
5. Click "Create repository"

### 2. Connect Your Local Folder to GitHub

Open Command Prompt or PowerShell in the project folder and run:

```bash
cd C:\Users\willi\.gemini\antigravity\scratch\ocean-data-viewer
git init
git add .
git commit -m "Initial commit - Ocean Data Viewer"
git branch -M main
git remote add origin https://github.com/raewm/ocean-data-viewer.git
git push -u origin main
```

### 3. Enable GitHub Pages
1. Go to your repo: https://github.com/raewm/ocean-data-viewer
2. Click **Settings** tab
3. Click **Pages** in the left sidebar
4. Under "Source", select **gh-pages** branch
5. Click Save

## Deploying Updates

### Easy Way: Use the Batch Script
Just double-click: `deploy-github.bat`

This will automatically:
- Build the production version
- Deploy to GitHub Pages

### Manual Way
Run these commands:
```bash
cd C:\Users\willi\.gemini\antigravity\scratch\ocean-data-viewer
set NODE_OPTIONS=--max-old-space-size=4096
npm run deploy
```

## After First Deployment

1. Wait 1-2 minutes for GitHub to process
2. Visit: https://raewm.github.io/ocean-data-viewer/
3. Test with your data files!

4. Refresh your browser

### Mandatory Version Increment
Before every deployment, you MUST increment the application version:
1.  **MINOR** increment for features (e.g., v1.4.3 -> v1.5.0)
2.  **PATCH** increment for bug fixes (e.g., v1.5.0 -> v1.5.1)

Update version in:
- `package.json`
- `src/App.jsx` footer

## Troubleshooting

**"gh-pages not found"**
- Run: `npm install` first

**"remote: Permission denied"**
- You need to authenticate with GitHub
- Use GitHub Desktop or set up SSH keys

**"404 - Page not found"**
- Check Settings → Pages shows the correct branch (gh-pages)
- Wait a few minutes - first deployment can take 5-10 minutes

**Changes not appearing**
- Hard refresh: Ctrl + Shift + R
- Check the deployment time at Settings → Pages

## Keeping Source Code Updated

To also push your source code changes to GitHub:
```bash
git add .
git commit -m "Description of changes"
git push origin main
```

The `deploy-github.bat` script handles the gh-pages branch automatically!
