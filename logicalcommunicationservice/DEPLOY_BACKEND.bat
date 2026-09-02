@echo off
setlocal
cd /d "%~dp0"
where firebase >nul 2>nul || (echo Firebase CLI is required. Install it with: npm install -g firebase-tools & pause & exit /b 1)
cd functions
call npm install
if errorlevel 1 exit /b 1
cd ..
echo Deploying Firestore rules, indexes, and E.R.A.S. backend functions...
call firebase deploy --project logicalcommunicationservice --only firestore:rules,firestore:indexes,functions
pause
