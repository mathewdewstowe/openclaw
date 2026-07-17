@echo off
REM Call Copilot launcher (Windows)
cd /d "%~dp0"

if not exist ".venv" (
  echo First run - creating virtualenv and installing dependencies...
  python -m venv .venv
  call ".venv\Scripts\python.exe" -m pip install --upgrade pip
  call ".venv\Scripts\pip.exe" install -r requirements.txt
)

start "" http://127.0.0.1:8777
".venv\Scripts\python.exe" server.py
