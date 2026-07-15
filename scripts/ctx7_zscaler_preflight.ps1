[CmdletBinding()]
param(
    [string]$Url = "https://context7.com/",
    [int]$TimeoutSeconds = 30,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

function Write-Status {
    param([string]$Message)

    if (-not $Quiet) {
        Write-Host $Message
    }
}

function New-WebClient {
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $true
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $handler.AutomaticDecompression =
        [System.Net.DecompressionMethods]::GZip -bor
        [System.Net.DecompressionMethods]::Deflate

    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    $client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 ctx7-zscaler-preflight/1.0")
    return $client
}

function Get-HiddenInputValue {
    param(
        [string]$Html,
        [string]$Name
    )

    $escapedName = [regex]::Escape($Name)
    $patterns = @(
        "<input[^>]*name=[`"']$escapedName[`"'][^>]*value=[`"']([^`"']*)[`"'][^>]*>",
        "<input[^>]*value=[`"']([^`"']*)[`"'][^>]*name=[`"']$escapedName[`"'][^>]*>"
    )

    foreach ($pattern in $patterns) {
        $match = [regex]::Match($Html, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($match.Success) {
            return [Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
        }
    }

    throw "Zscaler confirmation field '$Name' is missing."
}

function Test-IsContext7Response {
    param([System.Net.Http.HttpResponseMessage]$Response)

    $hostName = $Response.RequestMessage.RequestUri.Host
    return $Response.IsSuccessStatusCode -and $hostName -notmatch "(^|\.)zscloud\.net$"
}

$client = $null
$verificationClient = $null

try {
    $client = New-WebClient
    $response = $client.GetAsync($Url).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if (Test-IsContext7Response $response) {
        Write-Status "Context7 is reachable; no Zscaler confirmation is required."
        exit 0
    }

    $isApprovedWarning =
        $response.StatusCode -eq [Net.HttpStatusCode]::Forbidden -and
        $response.Headers.Server.ToString() -match "Zscaler" -and
        $body -match "CC01" -and
        $body -match "Generative AI and ML Applications" -and
        $body -match "gateway\.zscloud\.net(?::443)?/_sm_ctn"

    if (-not $isApprovedWarning) {
        [Console]::Error.WriteLine(
            "Context7 is unavailable, but the response is not the approved Zscaler CC01 confirmation page."
        )
        exit 2
    }

    $actionMatch = [regex]::Match(
        $body,
        "<form[^>]*method=[`"']GET[`"'][^>]*action=[`"']([^`"']+)[`"']",
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if (-not $actionMatch.Success) {
        throw "Zscaler confirmation form action is missing."
    }

    $action = [Net.WebUtility]::HtmlDecode($actionMatch.Groups[1].Value)
    $targetUrl = Get-HiddenInputValue -Html $body -Name "_sm_url"
    $requestId = Get-HiddenInputValue -Html $body -Name "_sm_rid"
    $category = Get-HiddenInputValue -Html $body -Name "_sm_cat"

    $query = @(
        "_sm_url=$([Uri]::EscapeDataString($targetUrl))"
        "_sm_rid=$([Uri]::EscapeDataString($requestId))"
        "_sm_cat=$([Uri]::EscapeDataString($category))"
    ) -join "&"

    Write-Status "Confirming the approved Zscaler CC01 warning for Context7..."
    $confirmationResponse = $client.GetAsync("$action`?$query").GetAwaiter().GetResult()
    $null = $confirmationResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    $verificationClient = New-WebClient
    $verificationResponse = $verificationClient.GetAsync($Url).GetAwaiter().GetResult()

    if (-not (Test-IsContext7Response $verificationResponse)) {
        [Console]::Error.WriteLine(
            "Zscaler confirmation completed, but Context7 is still not directly reachable."
        )
        exit 3
    }

    Write-Status "Zscaler confirmation completed; Context7 is reachable."
    exit 0
}
catch {
    [Console]::Error.WriteLine("Context7 Zscaler preflight failed: $($_.Exception.Message)")
    exit 4
}
finally {
    if ($verificationClient) {
        $verificationClient.Dispose()
    }
    if ($client) {
        $client.Dispose()
    }
}
