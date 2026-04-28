@echo off
echo ========================================
echo  Ocean Data Viewer - GitHub Pages Deploy
echo ========================================
echo.
echo This will:
echo 1. Commit source changes to main branch
echo 2. Push source to GitHub (main)
echo 3. Build the production version
echo 4. Deploy to GitHub Pages (gh-pages branch)
echo.
pause

cd /d C:\Users\willi\.gemini\antigravity\scratch\ocean-data-viewer

echo.
echo [1/4] Staging source changes...
git add src package.json package-lock.json vite.config.js index.html README.md DEPLOYMENT.md deploy-github.bat

git diff --cached --quiet
if %ERRORLEVEL% == 0 (
    echo No source changes to commit - already up to date.
) else (
    set /p COMMIT_MSG="Enter commit message: "
    if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update source
    git commit -m "%COMMIT_MSG%"
)

echo.
echo [2/4] Pushing source to GitHub (main)...
git push origin main

echo.
echo [3/4] Building production version...
set NODE_OPTIONS=--max-old-space-size=4096
call npm run build

echo.
echo [4/4] Deploying to GitHub Pages...
call npm run deploy

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Source code synced to: https://github.com/raewm/ocean-data-viewer
echo Live site at:          https://raewm.github.io/ocean-data-viewer/
echo.
echo Note: It may take 1-2 minutes for the live site to update
echo.
pause
