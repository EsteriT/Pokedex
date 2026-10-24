$ErrorActionPreference = 'Stop'
$walletRepo = Split-Path $PSScriptRoot -Parent
$walletTestRoot = Join-Path $walletRepo ('.scratch/pokewallet-wrapper-' + [Guid]::NewGuid().ToString('N'))
$walletPreviousKey = $env:POKEWALLET_API_KEY
function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    if (-not $AsSecureString) { throw 'The wrapper must request a hidden key.' }
    ConvertTo-SecureString 'fixture-key-for-wrapper-check-only' -AsPlainText -Force
}
try {
    New-Item -ItemType Directory -Path $walletTestRoot | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'enter-pokewallet-pilot.ps1') -Destination $walletTestRoot
    $walletFixture = 'console.log(JSON.stringify({script:require("node:path").basename(__filename),args:process.argv.slice(2),hiddenKey:process.env.POKEWALLET_API_KEY==="fixture-key-for-wrapper-check-only"}));'
    foreach ($walletName in @('catalogue-pokewallet-pilot.cjs', 'catalogue-pokewallet-images.cjs')) {
        [IO.File]::WriteAllText((Join-Path $walletTestRoot $walletName), $walletFixture)
    }
    $env:POKEWALLET_API_KEY = 'wrapper-restore-fixture'
    foreach ($walletMode in @('Metadata', 'Images', 'RemainingImages')) {
        $walletFlags = @{}
        if ($walletMode -ne 'Metadata') { $walletFlags[$walletMode] = $true }
        $walletOutput = & (Join-Path $walletTestRoot 'enter-pokewallet-pilot.ps1') @walletFlags
        $walletActual = $walletOutput | ConvertFrom-Json
        $walletExpectedScript = if ($walletMode -eq 'Metadata') { 'catalogue-pokewallet-pilot.cjs' } else { 'catalogue-pokewallet-images.cjs' }
        if ($walletActual.script -ne $walletExpectedScript -or -not $walletActual.hiddenKey) { throw "Wrong script or missing hidden key for $walletMode." }
        if ($walletMode -eq 'RemainingImages') {
            if ($walletActual.args.Count -ne 1 -or $walletActual.args[0] -cne '--remaining') { throw 'The native Node process must receive one intact --remaining argument.' }
        } elseif ($walletActual.args.Count -ne 0) { throw "Unexpected arguments for $walletMode." }
        if ($env:POKEWALLET_API_KEY -cne 'wrapper-restore-fixture') { throw 'The wrapper did not restore its environment.' }
    }
    Write-Output 'Pokewallet wrapper checks passed: all three modes, intact native argument and key environment restored. No network requests.'
} finally {
    $env:POKEWALLET_API_KEY = $walletPreviousKey
    $walletResolvedRoot = [IO.Path]::GetFullPath($walletTestRoot)
    $walletScratchRoot = [IO.Path]::GetFullPath((Join-Path $walletRepo '.scratch')) + [IO.Path]::DirectorySeparatorChar
    if (-not $walletResolvedRoot.StartsWith($walletScratchRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside the repository scratch folder.' }
    if (Test-Path -LiteralPath $walletResolvedRoot) { Remove-Item -LiteralPath $walletResolvedRoot -Recurse -Force }
}
