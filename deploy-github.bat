@echo off
echo ========================================
echo  Ocean Data Viewer - GitHub Pages Deploy
echo ========================================
echo.
echo This will:
echo 1. Commit source changes to main branch
echo 2. Build the production version
echo 3. Deploy to GitHub Pages (gh-pages branch)
echo.
echo Make sure you have:
echo - Initialized git in this folder (git init)
echo - Added remote (git remote add origin ...)
echo.
pause

cd /d C:\Users\willi\.gemini\antigravity\scratch\ocean-data-viewer

echo.
echo [1/4] Committing source changes to main...
git add src package.json package-lock.json vite.config.js index.html README.md DEPLOYMENT.md
git diff --cached --quiet
if %ERRORLEVEL% == 0 (
    echo No source changes to commit.
) else (
    set /p COMMIT_MSG="Enter commit message (or press Enter for timestamp): "
    if "%COMMIT_MSG%"=="" (
        for /f "tokens=1-5 delims=/ " %%a in ('date /t') do set DATESTR=%%a-%%b-%%c
        for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIMESTR=%%a%%b
        set COMMIT_MSG=Update %DATESTR% %TIMESTR%
    )
    git commit -m "%COMMIT_MSG%"
    git push origin main
)

echo.
echo [2/4] Installing / updating packages...
call npm install

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
echo Source code committed to: main branch
echo Live site at: https://raewm.github.io/ocean-data-viewer/
echo.
echo Note: It may take 1-2 minutes for changes to appear
echo.
pause
