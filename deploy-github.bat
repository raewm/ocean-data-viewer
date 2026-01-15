@echo off
echo ========================================
echo  Ocean Data Viewer - GitHub Pages Deploy
echo ========================================
echo.
echo This will:
echo 1. Build the production version
echo 2. Deploy to GitHub Pages
echo.
echo Make sure you have:
echo - Created a repo: https://github.com/raewm/ocean-data-viewer
echo - Initialized git in this folder (git init)
echo - Added remote (git remote add origin ...)
echo.
pause

cd /d C:\Users\willi\.gemini\antigravity\scratch\ocean-data-viewer

echo.
echo [1/3] Installing gh-pages package...
call npm install

echo.
echo [2/3] Building production version...
set NODE_OPTIONS=--max-old-space-size=4096
call npm run build

echo.
echo [3/3] Deploying to GitHub Pages...
call npm run deploy

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Your site will be available at:
echo https://raewm.github.io/ocean-data-viewer/
echo.
echo Note: It may take 1-2 minutes for changes to appear
echo.
pause
