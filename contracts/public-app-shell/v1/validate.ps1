$ErrorActionPreference = 'Stop'

$contractRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$contractPath = Join-Path $contractRoot 'contract.json'
$schemaPath = Join-Path $contractRoot 'schema.json'
$htmlPath = Join-Path $contractRoot 'reference.html'
$tokensPath = Join-Path $contractRoot 'tokens.css'
$cssPath = Join-Path $contractRoot 'reference.css'
$scriptPath = Join-Path $contractRoot 'reference.js'

function Assert-Contract {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw "Contract validation failed: $Message"
    }
}

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$schema = Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json
$html = Get-Content -LiteralPath $htmlPath -Raw
$tokens = Get-Content -LiteralPath $tokensPath -Raw
$css = Get-Content -LiteralPath $cssPath -Raw
$script = Get-Content -LiteralPath $scriptPath -Raw

$expectedConsumers = @(
    'noodle-calculator',
    'sky',
    'cloud-post',
    'somewhere-now',
    'gravity-loop',
    'waste-guide',
    'daylight'
)

Assert-Contract ($contract.id -eq 'public-app-shell/v1') 'contract id'
Assert-Contract ($contract.version -eq '1.0.0') 'contract version'
Assert-Contract ($contract.status -eq 'stable') 'stable status'
Assert-Contract ($schema.properties.id.const -eq 'public-app-shell/v1') 'schema id'
Assert-Contract ($schema.properties.version.const -eq '1.0.0') 'schema version'
Assert-Contract ($contract.runtimeDependency -eq $false) 'no runtime dependency'
Assert-Contract ($contract.databaseDependency -eq $false) 'no database dependency'
Assert-Contract ($contract.productionApproved -eq $false) 'production remains unapproved'

$actualConsumers = @($contract.consumers | Sort-Object)
$sortedExpected = @($expectedConsumers | Sort-Object)
Assert-Contract (
    (Compare-Object -ReferenceObject $sortedExpected -DifferenceObject $actualConsumers).Count -eq 0
) 'exact public app consumers'
Assert-Contract ($contract.excludedConsumers -contains 'calendar') 'calendar exclusion'
Assert-Contract ($contract.languages.required -contains 'de') 'German required'
Assert-Contract ($contract.languages.required -contains 'en') 'English required'
Assert-Contract (
    $contract.languages.storageKeyPattern -eq 'milosapps.<app-key>.language'
) 'per-app language storage'

Assert-Contract (
    $contract.environments.dev.links.apps -eq 'https://dev.milos-apps.de/apps'
) 'DEV apps URL'
Assert-Contract (
    $contract.environments.production.links.apps -eq 'https://milos-apps.de/apps'
) 'Production apps URL'
Assert-Contract (
    $contract.environments.dev.links.legal -eq 'https://dev.milos-apps.de/impressum'
) 'DEV legal URL'
Assert-Contract (
    $contract.environments.production.links.privacy -eq 'https://milos-apps.de/datenschutz'
) 'Production privacy URL'

Assert-Contract ($contract.header.position -eq 'normal-flow') 'normal-flow header'
Assert-Contract ($contract.header.icon.format -eq 'svg') 'SVG icon'
Assert-Contract ($contract.header.icon.visibleSizeMinPx -eq 36) 'icon min'
Assert-Contract ($contract.header.icon.visibleSizeMaxPx -eq 40) 'icon max'
Assert-Contract ($contract.header.controlsMinTargetPx -eq 44) '44px controls'
Assert-Contract ($contract.layout.mobileTestWidthPx -eq 390) '390px mobile test'
Assert-Contract ($contract.layout.zoomPercent -eq 200) '200 percent zoom test'
Assert-Contract ($contract.layout.reducedMotionRequired -eq $true) 'reduced motion'

foreach ($element in @('header', 'nav', 'main', 'footer')) {
    Assert-Contract ($html -match "<$element(?:\s|>)") "semantic $element"
}

Assert-Contract (([regex]::Matches($html, '<h1(?:\s|>)')).Count -eq 1) 'one H1'
Assert-Contract ($html -match 'data-app-key="example-app"') 'explicit app key'
Assert-Contract ($html -match 'data-environment="dev"') 'explicit environment'
Assert-Contract ($html -match 'data-language="de"') 'DE control'
Assert-Contract ($html -match 'data-language="en"') 'EN control'
Assert-Contract ($html -match 'aria-pressed="true"') 'active language state'
Assert-Contract ($html -match 'data-shell-link="apps"') 'all apps link'
Assert-Contract ($html -match 'data-shell-link="legal"') 'legal link'
Assert-Contract ($html -match 'data-shell-link="privacy"') 'privacy link'
Assert-Contract ($html -match '<svg') 'app SVG slot'

Assert-Contract ($tokens -match '--milos-shell-icon-size:\s*2\.375rem') '38px icon token'
Assert-Contract ($tokens -match '--milos-shell-control-min:\s*2\.75rem') '44px target token'
Assert-Contract ($css -match ':focus-visible') 'visible focus style'
Assert-Contract ($css -match 'prefers-reduced-motion:\s*reduce') 'reduced motion CSS'
Assert-Contract ($css -match 'position:\s*static') 'non-sticky header'
Assert-Contract ($script -match 'milosapps\.\$\{appKey\}\.language') 'per-app storage key'
Assert-Contract ($script -match 'document\.documentElement\.lang') 'document language'
Assert-Contract ($script -match 'document\.title') 'translated title'
Assert-Contract ($script -match 'https://dev\.milos-apps\.de/apps') 'DEV link map'
Assert-Contract ($script -match 'https://milos-apps\.de/apps') 'Production link map'

Write-Output 'public-app-shell/v1 validation: PASS'
Write-Output "Consumers: $($expectedConsumers.Count); languages: de/en; environments: dev/production"
