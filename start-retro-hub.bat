@echo off
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
    echo Node.js is required to start Retro Hub.
    pause
    exit /b 1
)
node.exe "%~dp0server.cjs"
if errorlevel 1 (
    pause
    exit /b 1
)
