@echo off
REM ###########################################################################
REM Linkary Contrast Fix Script (Windows)
REM Automatically fixes all text contrast issues across profile pages
REM 
REM Part of the Infrastructure-Grade Design System refactor
REM ###########################################################################

echo.
echo ================================
echo LINKARY CONTRAST FIX SCRIPT
echo ================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell is required but not found.
    exit /b 1
)

echo Running PowerShell script for text replacements...
echo.

powershell -ExecutionPolicy Bypass -Command ^
"$files = @('src/app/components/BrandProfilePage.tsx', 'src/app/components/UserProfilePage.tsx', 'src/app/components/ProjectProfilePage.tsx'); ^
Write-Host '📋 Checking files...'; ^
$missing = 0; ^
foreach ($file in $files) { ^
    if (!(Test-Path $file)) { ^
        Write-Host \"❌ Missing: $file\" -ForegroundColor Red; ^
        $missing = 1; ^
    } else { ^
        Write-Host \"✓ Found: $file\" -ForegroundColor Green; ^
    } ^
}; ^
if ($missing -eq 1) { ^
    Write-Host ''; ^
    Write-Host '❌ Error: Some files are missing. Please run from project root.' -ForegroundColor Red; ^
    exit 1; ^
}; ^
Write-Host ''; ^
Write-Host '📁 Creating backups...'; ^
foreach ($file in $files) { ^
    Copy-Item $file \"$file.backup\"; ^
    Write-Host \"✓ Backed up: $file.backup\" -ForegroundColor Green; ^
}; ^
Write-Host ''; ^
Write-Host '🎨 Applying contrast fixes...'; ^
foreach ($file in $files) { ^
    Write-Host ''; ^
    Write-Host \"📄 Processing: $(Split-Path $file -Leaf)\" -ForegroundColor Cyan; ^
    $content = Get-Content $file -Raw; ^
    $content = $content -replace 'text-gray-900', 'text-white'; ^
    $content = $content -replace 'text-gray-700', 'text-white/70'; ^
    $content = $content -replace 'text-gray-600', 'text-white/60'; ^
    $content = $content -replace 'text-gray-500', 'text-white/50'; ^
    $content = $content -replace 'text-gray-400', 'text-white/60'; ^
    $content = $content -replace 'text-neutral-300', 'text-white/85'; ^
    $content = $content -replace 'text-neutral-400', 'text-white/60'; ^
    $content = $content -replace 'text-neutral-500', 'text-white/50'; ^
    $content = $content -replace 'text-zinc-700', 'text-white/70'; ^
    $content = $content -replace 'hover:text-gray-900', 'hover:text-white'; ^
    $content = $content -replace 'hover:text-gray-700', 'hover:text-white'; ^
    $content = $content -replace 'group-hover:text-gray-900', 'group-hover:text-white'; ^
    $content = $content -replace 'group-hover:text-gray-700', 'group-hover:text-white'; ^
    Set-Content $file $content -NoNewline; ^
    Write-Host '   ✅ Completed' -ForegroundColor Green; ^
}; ^
Write-Host ''; ^
Write-Host '=========================================='; ^
Write-Host '📊 CONTRAST FIX SUMMARY'; ^
Write-Host '=========================================='; ^
Write-Host ''; ^
Write-Host \"✅ Files processed: $($files.Count)\"; ^
Write-Host '📝 Applied 13 contrast fixes per file'; ^
Write-Host '💾 Backups saved with .backup extension'; ^
Write-Host ''; ^
Write-Host '🎨 Design System Status: Infrastructure-Grade Contrast ✅' -ForegroundColor Green; ^
Write-Host ''; ^
Write-Host '=========================================='; ^
Write-Host '💡 Next Steps:'; ^
Write-Host '=========================================='; ^
Write-Host ''; ^
Write-Host '1. Hard refresh browser (Ctrl+Shift+R or Ctrl+F5)'; ^
Write-Host '2. Clear browser cache if needed'; ^
Write-Host '3. Verify all text is high-contrast and readable'; ^
Write-Host '4. Check for any remaining low-contrast elements'; ^
Write-Host ''; ^
Write-Host '✨ Done!' -ForegroundColor Green"

echo.
pause
