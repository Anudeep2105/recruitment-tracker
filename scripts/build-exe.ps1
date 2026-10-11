$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$node = (Get-Command node.exe).Source
node --experimental-sea-config sea-config.json
Copy-Item -Force $node dist\NorthstarRecruitment.exe
& node_modules\.bin\postject.cmd dist\NorthstarRecruitment.exe NODE_SEA_BLOB dist\sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if ($LASTEXITCODE -ne 0) { throw 'Executable injection failed.' }
Remove-Item -Force dist\sea-prep.blob
Write-Host "Built: $root\dist\NorthstarRecruitment.exe"


