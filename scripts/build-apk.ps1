<#
  Construit l'APK Android de Stockr (debug) depuis un dépôt fraîchement cloné.
  Usage (depuis la racine du dépôt) :  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
  Résultat : stockr.apk à la racine du dépôt.

  Prérequis : Node 20+, JDK 17 (ou Android Studio, dont le JDK intégré est détecté),
  Android SDK (plateforme 34). Voir README.md.
#>
$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'stockr-mobile'
$android = Join-Path $mobile 'android'

# --- JDK -------------------------------------------------------------------
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  $candidates = @(
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "$env:ProgramFiles\Eclipse Adoptium\jdk-17*",
    "$env:ProgramFiles\Java\jdk-17*"
  )
  $found = $candidates | ForEach-Object { Get-Item $_ -ErrorAction SilentlyContinue } | Select-Object -First 1
  if (-not $found) { throw "JDK 17 introuvable : installe-le ou définis JAVA_HOME." }
  $env:JAVA_HOME = $found.FullName
}
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
Write-Host "JAVA_HOME = $env:JAVA_HOME"

# --- SDK Android -----------------------------------------------------------
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path $sdk)) { throw "Android SDK introuvable ($sdk) : installe Android Studio ou définis ANDROID_HOME." }
$localProps = Join-Path $android 'local.properties'
if (-not (Test-Path $localProps)) {
  # local.properties est propre à chaque machine : il n'est pas dans Git
  'sdk.dir=' + ($sdk -replace '\\', '\\') | Set-Content $localProps -Encoding ascii
  Write-Host "local.properties créé (sdk.dir = $sdk)"
}

# --- Application web (Vite) puis projet Android ----------------------------
Push-Location $mobile
try {
  npm ci
  if ($LASTEXITCODE) { throw "npm ci a échoué" }
  npm run build
  if ($LASTEXITCODE) { throw "npm run build a échoué" }
  npx cap sync android
  if ($LASTEXITCODE) { throw "cap sync a échoué" }
} finally { Pop-Location }

Push-Location $android
try {
  .\gradlew.bat assembleDebug
  if ($LASTEXITCODE) { throw "gradle assembleDebug a échoué" }
} finally { Pop-Location }

$apk = Join-Path $android 'app\build\outputs\apk\debug\app-debug.apk'
Copy-Item $apk (Join-Path $root 'stockr.apk') -Force
Write-Host "`nOK : $(Join-Path $root 'stockr.apk')"
