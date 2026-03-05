@echo off
echo Launching Chrome with remote debugging on port 9222...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --profile-directory="Default"
echo Chrome launched. You can now run LinkedIn automation from WSL.
