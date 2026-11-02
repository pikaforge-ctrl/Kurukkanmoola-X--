@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js, then run this file again.
 pause
 exit /b 1
)
if exist .kurukkanmoola-port del /q .kurukkanmoola-port >nul 2>nul
start "Kurukkanmoola X Server" /b cmd /c "node server.mjs"
for /l %%i in (1,1,30) do (
 if exist .kurukkanmoola-port goto READY
 timeout /t 1 /nobreak >nul
)
echo Server did not start. Check the console for errors.
pause
exit /b 1
:READY
set /p PORT=<.kurukkanmoola-port
start "" http://localhost:%PORT%
echo.
echo Kurukkanmoola X is running at http://localhost:%PORT%
echo Close this window to stop the server.
pause
