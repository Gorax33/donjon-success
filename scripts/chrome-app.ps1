# Lance l'outil en "application Chrome" : un petit serveur local (invisible) sert la
# version compilée, puis Chrome l'ouvre dans une fenêtre sans barre d'adresse.
# Lancé par le raccourci du bureau (voir scripts/create-shortcut.ps1).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 4173
$url = "http://localhost:$port/"

function Test-Server {
  try {
    Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 1 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-Server)) {
  # Recompile pour toujours servir la dernière version du code
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run build' -WorkingDirectory $root `
    -WindowStyle Hidden -Wait
  # Serveur invisible ; il reste actif après la fermeture de la fenêtre (relance instantanée)
  Start-Process -FilePath 'cmd.exe' -ArgumentList "/c npx vite preview --port $port --strictPort" `
    -WorkingDirectory $root -WindowStyle Hidden
  for ($i = 0; $i -lt 60 -and -not (Test-Server); $i++) {
    Start-Sleep -Milliseconds 250
  }
}

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  # Pas de Chrome : Edge fait aussi le mode application
  $chrome = 'msedge.exe'
}

Start-Process -FilePath $chrome -ArgumentList "--app=$url", '--window-size=400,720'
