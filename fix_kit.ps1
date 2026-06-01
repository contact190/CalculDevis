$file = "src\modules\commercial\CommercialModule.jsx"
$lines = Get-Content $file -Encoding UTF8

$output = New-Object System.Collections.Generic.List[string]
$i = 0
$skipUntilEnd = $false
$firstKitDone = $false

while ($i -lt $lines.Count) {
    $line = $lines[$i]

    # Detect start of a kit compatibility block
    if ($line -match '// Apply compatibility formula for kits') {

        if (-not $firstKitDone) {
            # --- FIRST BLOCK: replace with corrected version ---
            $firstKitDone = $true

            # Add the corrected block
            $output.Add('                  // Apply compatibility formula for kits')
            $output.Add('                   if (key === ''kitId'' || key === ''kits'') {')
            $output.Add('                     const isDouble = config.shutterConfig?.isDoubleShutter || false;')
            $output.Add('                     const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);')
            $output.Add('                     const H = config.H || 0;')
            $output.Add('                     const area = (L * H) / 1000000;')
            $output.Add('                     ')
            $output.Add('                     const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === config.shutterConfig?.lameId);')
            $output.Add('                     const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;')
            $output.Add('                     const totalWeight = area * weightPerM2;')
            $output.Add('')
            $output.Add('                     const selectedCaissonKit = (database.shutterComponents?.caissons || []).find(c => c.id === config.shutterConfig?.caissonId);')
            $output.Add('                     const caissonSize = parseFloat(selectedCaissonKit?.height) || parseFloat(selectedCaissonKit?.size) || parseFloat(selectedCaissonKit?.thickness) || 0;')
            $output.Add('')
            $output.Add('                     const axesKit = database.shutterComponents?.axes || [];')
            $output.Add('                     const selectedAxeKit = axesKit.find(a => a.id === config.shutterConfig?.axeId) || axesKit[0];')
            $output.Add('                     const axeDiameter = selectedAxeKit ? parseFloat(selectedAxeKit.diameter) || parseFloat((selectedAxeKit.name || '''').match(/\d+/)?.[0]) || 0 : 0;')
            $output.Add('')
            $output.Add('                     filteredItems = filteredItems.filter(kit => {')
            $output.Add('                       const formula = kit.compatibilityFormula;')
            $output.Add('                       if (!formula || formula.trim() === '''') return true;')
            $output.Add('                       try {')
            $output.Add('                         const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;')
            $output.Add('                         const scope = { L, H, area, totalWeight, weightPerM2, lameWidth, caissonSize, axeDiameter };')
            $output.Add('                         return engine.evaluate(formula, scope);')
            $output.Add('                       } catch (e) {')
            $output.Add('                         console.warn(`[Kit Compatibility] Formula error for "${kit.name}":`, e.message);')
            $output.Add('                         return true;')
            $output.Add('                       }')
            $output.Add('                     });')
            $output.Add('                   }')

            # Skip until closing brace of this block
            $i++
            $depth = 0
            while ($i -lt $lines.Count) {
                $l = $lines[$i]
                if ($l -match 'if \(key === .kitId') { $depth++ }
                if ($l -match '^\s+\}$' -and $depth -eq 0) { $i++; break }
                if ($l -match '^\s+\}$') { $depth-- }
                $i++
            }
            continue

        } else {
            # --- SECOND BLOCK: skip it entirely ---
            $i++
            while ($i -lt $lines.Count) {
                $l = $lines[$i]
                $i++
                # Stop when we hit the closing } of the if block at the right indent
                if ($l -match '^                   \}$') { break }
            }
            continue
        }
    }

    $output.Add($line)
    $i++
}

$output | Set-Content $file -Encoding UTF8
Write-Host "Done. Kit blocks now:"
(Select-String -Path $file -Pattern "Apply compatibility formula for kits").Count
