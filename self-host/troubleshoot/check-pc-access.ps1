# PC-side diagnostic for peptivalabgroup.com access issues.
# Run in PowerShell (no admin required for most checks; DNS flush needs admin).
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\check-pc-access.ps1
#   powershell -ExecutionPolicy Bypass -File .\check-pc-access.ps1 -Domain example.com
#   powershell -ExecutionPolicy Bypass -File .\check-pc-access.ps1 -Fix   # attempts repairs (admin)

[CmdletBinding()]
param(
    [string]$Domain = "peptivalabgroup.com",
    [switch]$Fix
)

$ErrorActionPreference = "Continue"
$logDir  = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp   = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "check-pc-access-$stamp.log"

function Hdr($t)  { Write-Host "`n=== $t ===" -ForegroundColor Cyan;  "`n=== $t ===" | Out-File $logFile -Append }
function Info($t) { Write-Host "  $t" -ForegroundColor Gray;          "  $t"        | Out-File $logFile -Append }
function Ok($t)   { Write-Host "  OK   $t" -ForegroundColor Green;    "  OK   $t"   | Out-File $logFile -Append }
function Warn($t) { Write-Host "  WARN $t" -ForegroundColor Yellow;   "  WARN $t"   | Out-File $logFile -Append }
function Fail($t) { Write-Host "  FAIL $t" -ForegroundColor Red;      "  FAIL $t"   | Out-File $logFile -Append }
function Run($label, $sb) {
    Info $label
    try {
        $out = & $sb 2>&1 | Out-String
        $out | Out-File $logFile -Append
        return $out
    } catch {
        Fail $_.Exception.Message
        $_.Exception.Message | Out-File $logFile -Append
        return $null
    }
}

$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(`
    [Security.Principal.WindowsBuiltInRole]::Administrator)

Hdr "Environment"
Info "Domain:    $Domain"
Info "Log file:  $logFile"
Info "Admin:     $isAdmin"
Info "Host:      $env:COMPUTERNAME"
Info "User:      $env:USERNAME"

Hdr "1. Local network"
$out = Run "ipconfig /all" { ipconfig /all }
$dnsServers = (Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.ServerAddresses }) | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique
if ($dnsServers) { Ok ("DNS servers: " + ($dnsServers -join ", ")) } else { Warn "No DNS servers detected" }

Hdr "2. DNS resolution"
$ipv4 = $null; $ipv6 = $null
try {
    $a    = Resolve-DnsName -Name $Domain -Type A    -ErrorAction Stop
    $ipv4 = ($a    | Where-Object { $_.IPAddress }).IPAddress -join ", "
    Ok "A    $Domain -> $ipv4"
} catch { Fail "A record lookup failed: $($_.Exception.Message)" }
try {
    $aaaa = Resolve-DnsName -Name $Domain -Type AAAA -ErrorAction Stop
    $ipv6 = ($aaaa | Where-Object { $_.IPAddress }).IPAddress -join ", "
    if ($ipv6) { Info "AAAA $Domain -> $ipv6" } else { Info "AAAA: none" }
} catch { Info "AAAA lookup: none / failed" }

Run "Public DNS cross-check (1.1.1.1)" { Resolve-DnsName -Name $Domain -Type A -Server 1.1.1.1 }
Run "Public DNS cross-check (8.8.8.8)" { Resolve-DnsName -Name $Domain -Type A -Server 8.8.8.8 }

Hdr "3. DNS cache for $Domain"
$cache = Get-DnsClientCache -ErrorAction SilentlyContinue | Where-Object { $_.Entry -like "*$Domain*" }
if ($cache) { $cache | Format-Table -AutoSize | Out-String | Tee-Object -FilePath $logFile -Append | Out-Host }
else        { Info "No cached entries for $Domain" }

Hdr "4. hosts file overrides"
$hosts = "$env:WINDIR\System32\drivers\etc\hosts"
$hostMatches = Select-String -Path $hosts -Pattern $Domain -ErrorAction SilentlyContinue
if ($hostMatches) {
    Warn "hosts file contains entries for $Domain:"
    $hostMatches | ForEach-Object { Info $_.Line }
} else { Ok "No hosts file overrides" }

Hdr "5. Connectivity"
Run "Ping (4 packets)" { Test-Connection -ComputerName $Domain -Count 4 -ErrorAction SilentlyContinue }
Run "TCP 443"          { Test-NetConnection -ComputerName $Domain -Port 443 -InformationLevel Detailed }
Run "TCP 80"           { Test-NetConnection -ComputerName $Domain -Port 80  -InformationLevel Detailed }

Hdr "6. HTTPS request"
try {
    $resp = Invoke-WebRequest -Uri "https://$Domain" -Method Head -UseBasicParsing -TimeoutSec 15
    Ok "HTTPS $($resp.StatusCode) $($resp.StatusDescription)"
    $resp.Headers.GetEnumerator() | ForEach-Object { Info ("{0}: {1}" -f $_.Key, $_.Value) }
} catch { Fail "HTTPS request failed: $($_.Exception.Message)" }

Hdr "7. TLS certificate"
try {
    $tcp = New-Object System.Net.Sockets.TcpClient($Domain, 443)
    $ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, ({ $true }))
    $ssl.AuthenticateAsClient($Domain)
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
    Ok "Subject:    $($cert.Subject)"
    Info "Issuer:     $($cert.Issuer)"
    Info "Valid:      $($cert.NotBefore) -> $($cert.NotAfter)"
    Info "Thumbprint: $($cert.Thumbprint)"
    $ssl.Dispose(); $tcp.Close()
} catch { Fail "TLS check failed: $($_.Exception.Message)" }

Hdr "8. System proxy"
$proxy = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -ErrorAction SilentlyContinue
if ($proxy.ProxyEnable -eq 1) { Warn "System proxy ENABLED -> $($proxy.ProxyServer)" }
else                          { Ok   "No system proxy configured" }
if ($env:HTTP_PROXY -or $env:HTTPS_PROXY) {
    Warn "Env proxy: HTTP_PROXY=$env:HTTP_PROXY HTTPS_PROXY=$env:HTTPS_PROXY"
}

Hdr "9. Traceroute (max 20 hops)"
Run "tracert" { tracert -h 20 -w 2000 $Domain }

if ($Fix) {
    Hdr "10. Repairs (admin required)"
    if (-not $isAdmin) {
        Fail "Re-run PowerShell as Administrator to apply fixes."
    } else {
        Run "ipconfig /flushdns"      { ipconfig /flushdns }
        Run "ipconfig /registerdns"   { ipconfig /registerdns }
        Run "netsh winsock reset"     { netsh winsock reset }
        Run "netsh int ip reset"      { netsh int ip reset }
        Warn "Reboot recommended after winsock/ip reset."
    }
} else {
    Hdr "10. Suggested fixes"
    Info "Re-run with -Fix as Administrator to flush DNS and reset Winsock/IP stack:"
    Info "  powershell -ExecutionPolicy Bypass -File .\check-pc-access.ps1 -Fix"
    Info "Other things to try:"
    Info "  - Test in an incognito/private window (rules out extensions & cache)"
    Info "  - Try a different browser"
    Info "  - Disable VPN / antivirus web shield temporarily"
    Info "  - Switch DNS to 1.1.1.1 / 8.8.8.8"
    Info "  - Tether to phone hotspot to isolate the local network"
}

Hdr "Done"
Info "Full log: $logFile"
