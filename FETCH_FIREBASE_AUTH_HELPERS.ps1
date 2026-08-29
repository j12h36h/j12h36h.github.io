$ErrorActionPreference = "Stop"
$ProjectDomain = "https://logicalcommunicationservice.firebaseapp.com"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AuthDir = Join-Path $Root "__\auth"
$FirebaseDir = Join-Path $Root "__\firebase"
New-Item -ItemType Directory -Force -Path $AuthDir | Out-Null
New-Item -ItemType Directory -Force -Path $FirebaseDir | Out-Null
$Files = @("handler","handler.js","experiments.js","iframe","iframe.js","links","links.js")
foreach ($File in $Files) {
  Write-Host "Fetching $File"
  Invoke-WebRequest -UseBasicParsing -Uri "$ProjectDomain/__/auth/$File" -OutFile (Join-Path $AuthDir $File)
}
Invoke-WebRequest -UseBasicParsing -Uri "$ProjectDomain/__/firebase/init.json" -OutFile (Join-Path $FirebaseDir "init.json")
Write-Host "Done. Commit the generated __ folder at the ROOT of j12h36h.github.io together with lcs-mobile."
