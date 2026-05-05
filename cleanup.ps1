$file = "src\modules\production\ProductionModule.jsx"
$lines = Get-Content $file
$keep = $lines[0..2201] + $lines[2558..($lines.Count - 1)]
$keep | Set-Content $file -Encoding UTF8
Write-Host "Done. New line count: $($keep.Count)"
