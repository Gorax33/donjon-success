# Crée sur le bureau le raccourci "Succès Donjons (Chrome)" qui lance scripts/chrome-app.ps1
# Usage : npm run shortcut

$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Succès Donjons (Chrome).lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$root\scripts\chrome-app.ps1`""
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$root\src-tauri\icons\icon.ico"
$shortcut.WindowStyle = 7 # Réduit : évite le flash de la console PowerShell
$shortcut.Description = 'Suivi des succès de donjons Dofus (mode application Chrome)'
$shortcut.Save()

Write-Output "Raccourci créé : $shortcutPath"
