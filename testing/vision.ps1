param([string]$ImageUrl, [string]$Prompt)
$ErrorActionPreference = 'Stop'
$cfgPath = "$env:APPDATA\opencode\opencode.json"
if (-not (Test-Path $cfgPath)) { $cfgPath = "$env:USERPROFILE\.config\opencode\opencode.json" }
$key = $null
$svc = "$env:USERPROFILE\.config\opencode\service.json"
if (Test-Path $svc) {
  $sj = Get-Content $svc -Raw | ConvertFrom-Json
  $key = $sj.env.MAGPIE_KEY
}
if (-not $key -and (Test-Path $cfgPath)) {
  $oc = Get-Content $cfgPath -Raw | ConvertFrom-Json
  $key = ($oc.mcp.servers.magpie.headers.Authorization) -replace '^Bearer\s+',''
}
if (-not $key) { Write-Output "ERROR: no magpie key found at $cfgPath"; exit 1 }
$url = "http://192.168.2.1:3425/mcp/magpie/hub"
$init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"vision-cli","version":"1.0"}}}'
$r1 = Invoke-WebRequest -Uri $url -Method Post -Body $init -ContentType 'application/json' -Headers @{ Accept='application/json, text/event-stream'; Authorization="Bearer $key" } -TimeoutSec 30
$sid = $r1.Headers['Mcp-Session-Id']; if (-not $sid) { $sid = $r1.Headers['mcp-session-id'] }
$h = @{ Accept='application/json, text/event-stream'; Authorization="Bearer $key" }
if ($sid) { $h['Mcp-Session-Id'] = $sid }
try { Invoke-WebRequest -Uri $url -Method Post -Body '{"jsonrpc":"2.0","method":"notifications/initialized"}' -ContentType 'application/json' -Headers $h -TimeoutSec 10 | Out-Null } catch {}
$payload = @{ jsonrpc='2.0'; id=2; method='tools/call'; params=@{ name='magpie-vision__analyze_image'; arguments=@{ image=$ImageUrl; prompt=$Prompt } } } | ConvertTo-Json -Depth 8
$r2 = Invoke-WebRequest -Uri $url -Method Post -Body $payload -ContentType 'application/json' -Headers $h -TimeoutSec 120
$txt = $r2.Content
if ($txt -match '^\s*data:') { $txt = (($txt -split "`n") | Where-Object { $_ -match '^data:' } | Select-Object -First 1) -replace '^data:\s*','' }
$j = $txt | ConvertFrom-Json
if ($j.error) { Write-Output ("ERROR: " + ($j.error | ConvertTo-Json -Compress)); exit 1 }
$j.result.content | ForEach-Object { if ($_.type -eq 'text') { $_.text } else { $_ | ConvertTo-Json -Compress } }
