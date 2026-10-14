param([switch]$SkipChecks)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$companyRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '../..'))
$installerRoot = Join-Path $companyRoot 'softwares/kobb-installer'
$dotnetCommand = Join-Path $env:USERPROFILE '.tools/dotnet/dotnet.exe'
if (!(Test-Path -LiteralPath $dotnetCommand)) { $dotnetCommand = 'dotnet' }
$npmCommand = 'C:/Program Files/nodejs/npm.cmd'
if (!(Test-Path -LiteralPath $npmCommand)) { $npmCommand = 'npm.cmd' }
Push-Location $projectRoot
try {
    & $npmCommand ci
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar as dependências.' }
    if (!$SkipChecks) {
        & $npmCommand test
        if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes dos cálculos.' }
    }
    & $npmCommand run build
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar a interface.' }
    $iconPath = Join-Path $projectRoot 'src/Kobb.Atlas/obj/branding/atlas.ico'
    & $dotnetCommand restore (Join-Path $projectRoot 'src/Kobb.Atlas') -r win-x64
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar as dependências da distribuição Windows.' }
    if (!$SkipChecks) {
        $cadInput = Join-Path $projectRoot 'src/Kobb.Atlas/obj/export-check.dxf'
        $cadOutput = Join-Path $projectRoot 'src/Kobb.Atlas/obj/export-check.dwg'
        & 'C:/Program Files/nodejs/node.exe' (Join-Path $projectRoot 'tests/cad-fixture.mjs') $cadInput
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar o desenho de teste.' }
        & $dotnetCommand run --project (Join-Path $projectRoot 'tests/Kobb.Atlas.CadChecks') -c Release -p:UseSharedCompilation=false -- $cadInput $cadOutput
        if ($LASTEXITCODE -ne 0) { throw 'Falha na exportação DWG integrada.' }
    }
    & $dotnetCommand clean (Join-Path $projectRoot 'src/Kobb.Atlas') -c Release -v:q
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar os recursos da aplicação.' }
    & $dotnetCommand clean (Join-Path $projectRoot 'src/Kobb.Atlas') -c Release -r win-x64 -v:q
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar os recursos da distribuição.' }
    & $dotnetCommand run --project (Join-Path $projectRoot 'src/Kobb.Atlas') -c Release -p:UseSharedCompilation=false -- --export-icon $iconPath
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar o ícone.' }
    $payload = Join-Path $projectRoot 'payload'
    if (Test-Path -LiteralPath $payload) {
        $resolved = [IO.Path]::GetFullPath($payload)
        if ($resolved -ne [IO.Path]::GetFullPath((Join-Path $projectRoot 'payload'))) { throw 'Destino de compilação inválido.' }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
    & $dotnetCommand publish (Join-Path $projectRoot 'src/Kobb.Atlas') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:UseSharedCompilation=false "-p:ApplicationIcon=$iconPath" -o $payload
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o Atlas.' }
    Get-ChildItem -LiteralPath $payload -File -Filter '*.pdb' | Remove-Item -Force
    Get-ChildItem -LiteralPath $payload -File -Filter 'Microsoft.Web.WebView2.*.xml' | Remove-Item -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination (Join-Path $payload 'README.md')
    & 'C:/Program Files/nodejs/node.exe' (Join-Path $projectRoot 'scripts/Notices.mjs') (Join-Path $payload 'THIRD-PARTY-NOTICES.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preservar os avisos das dependências.' }
    & (Join-Path $installerRoot 'scripts/Prepare-Package.ps1') -ProductId kobb-atlas -ProductRoot $projectRoot
    $catalog = Get-Content -LiteralPath (Join-Path $projectRoot 'product.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $output = Join-Path $companyRoot 'products/kobb-atlas'
    $previousPayload = [IO.Path]::GetFullPath((Join-Path $output 'payload'))
    if (Test-Path -LiteralPath $previousPayload) {
        if ($previousPayload -ne [IO.Path]::GetFullPath((Join-Path $companyRoot 'products/kobb-atlas/payload'))) { throw 'Destino do pacote inválido.' }
        Remove-Item -LiteralPath $previousPayload -Recurse -Force
    }
    & (Join-Path $installerRoot 'scripts/Build.ps1') -ProductId kobb-atlas -ProductRoot $projectRoot -ProductIcon (Join-Path $projectRoot 'assets/atlas-logo.png') -PreparedIconPath $iconPath -OutputDirectory $output -ReleasePackage
    $installerPath = Join-Path $output "kobb-atlas-setup-$($catalog.version).exe"
    Move-Item -LiteralPath (Join-Path $output 'kobb-installer.exe') -Destination $installerPath -Force
    if (!$SkipChecks) {
        & $dotnetCommand run --project (Join-Path $projectRoot 'tests/Kobb.Atlas.Checks') -c Release -p:UseSharedCompilation=false -- (Join-Path $projectRoot 'product.json') $payload $installerPath
        if ($LASTEXITCODE -ne 0) { throw 'Falha na instalação e remoção do pacote de testes.' }
    }
    Get-ChildItem -LiteralPath $output -File -Filter '*.pdb' | Remove-Item -Force
    $previewCommand = '@start "" "%~dp0kobb-atlas-setup-' + $catalog.version + '.exe" --preview'
    [IO.File]::WriteAllText((Join-Path $output 'Abrir previa.cmd'), $previewCommand + "`r`n", [Text.Encoding]::ASCII)
    $zipPath = Join-Path $output "kobb-atlas-$($catalog.version)-win-x64.zip"
    Compress-Archive -LiteralPath $installerPath, (Join-Path $output 'product.json'), (Join-Path $output 'payload') -DestinationPath $zipPath -Force
    $hashes = @($installerPath, $zipPath) | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash + '  ' + [IO.Path]::GetFileName($_) }
    [IO.File]::WriteAllText((Join-Path $output 'SHA256.txt'), ($hashes -join "`n") + "`n", [Text.Encoding]::ASCII)
    Write-Output $installerPath
}
finally { Pop-Location }
