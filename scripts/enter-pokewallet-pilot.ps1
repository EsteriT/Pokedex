# Prompt locally without displaying, storing or placing the API key in command history.
param([switch]$Images, [switch]$RemainingImages)
$ErrorActionPreference = 'Stop'
$walletPreviousKey = $env:POKEWALLET_API_KEY
$walletSecret = Read-Host 'Paste your Pokewallet API key (hidden)' -AsSecureString
$walletPointer = [IntPtr]::Zero
try {
    $walletPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($walletSecret)
    $env:POKEWALLET_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($walletPointer)
    $walletScript = if ($Images -or $RemainingImages) { 'catalogue-pokewallet-images.cjs' } else { 'catalogue-pokewallet-pilot.cjs' }
    $walletArguments = @()
    if ($RemainingImages) { $walletArguments = @('--remaining') }
    & node (Join-Path $PSScriptRoot $walletScript) @walletArguments
    if ($LASTEXITCODE -ne 0) { throw 'Coverage pilot stopped; see the non-secret error above.' }
} finally {
    $env:POKEWALLET_API_KEY = $walletPreviousKey
    if ($walletPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($walletPointer)
    }
    $walletSecret.Dispose()
}
