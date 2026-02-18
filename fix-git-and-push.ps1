# Run this script AFTER closing Cursor completely (File -> Exit).
# Double-click fix-git-and-push.ps1 or run in PowerShell: .\fix-git-and-push.ps1

Set-Location $PSScriptRoot

$lock = ".git\index.lock"
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host "Removed .git\index.lock"
} else {
    Write-Host "No lock file found."
}

Write-Host "Untracking node_modules..."
git rm -r --cached node_modules 2>$null
git rm -r --cached apps/api/node_modules 2>$null
Write-Host "Done. Open Cursor and commit/push your real changes."
pause
