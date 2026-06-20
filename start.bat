@echo off
cd /d "%~dp0"
echo Minecraft Model Builder を起動しています...
echo.
echo ブラウザが自動で開かない場合は http://localhost:5173 にアクセスしてください。
echo.
start "" http://localhost:5173
npx vite --host --port 5173 --strictPort
if %ERRORLEVEL% NEQ 0 (
    echo Port 5173 は使用中のため、別のポートで起動します...
    npx vite --host
)
pause
