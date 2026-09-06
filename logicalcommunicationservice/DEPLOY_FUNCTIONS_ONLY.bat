@echo off
setlocal
cd /d "%~dp0"
where firebase >nul 2>nul || (echo Firebase CLI is required. Install it with: npm install -g firebase-tools & pause & exit /b 1)
cd functions
call npm install
if errorlevel 1 exit /b 1
cd ..
echo Deploying E.R.A.S. backend functions only. Firestore rules will NOT be touched.
call firebase deploy --project logicalcommunicationservice --only functions
pause
