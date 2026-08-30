@echo off
cd /d "%~dp0"
echo.
echo Starting Tethr...
echo Open http://localhost:4173 in your browser.
echo Keep this window open while using Tethr.
echo.
node server/server.mjs
pause
