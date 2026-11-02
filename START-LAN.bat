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
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address" /C:"IPv4"') do set "RAWIP=%%a"
set "RAWIP=%RAWIP: =%"
for /f "tokens=1 delims=(" %%a in ("%RAWIP%") do set "LANIP=%%a"
if not defined LANIP set "LANIP=127.0.0.1"

echo.
echo ==============================================
echo        KURUKKANMOOLA X - LAN SERVER
echo ==============================================
echo.
echo This PC:   http://localhost:%PORT%
echo Other devices on the SAME Wi-Fi/LAN:
echo            http://%LANIP%:%PORT%
echo.
echo Give the LAN URL above to the other device.
echo Both devices must be connected to the same Wi-Fi.
echo.
echo If Windows Firewall asks, allow Node.js on Private networks.
echo ==============================================
echo.
start "" http://%LANIP%:%PORT%
pause
