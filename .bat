@echo off
REM Navigate to your project folder
cd /d "C:\path\to\your\project\folder"

REM Run git pull silently in background
START /B /MIN cmd /c "git pull > nul 2>&1"

REM Wait a moment for git pull to complete
timeout /t 2 /nobreak > nul

REM Run Python script hidden in background using pythonw
START /B pythonw app_copy.py

REM Wait for server to start
timeout /t 3 /nobreak > nul

REM Open browser (only visible action)
START "" "http://localhost:8000"

REM Exit batch file
exit
