# Sinh anh mau tu tao cho fixture AI (khong lay tu internet).
# Chay tu goc repo: powershell -ExecutionPolicy Bypass -File contracts/scripts/make-images.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\fixtures\ai'))
New-Item -ItemType Directory -Force $dir | Out-Null

function New-SampleImage([string]$Path, [System.Drawing.Imaging.ImageFormat]$Format) {
    $bmp = New-Object System.Drawing.Bitmap -ArgumentList 160, 120
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(40, 40, 40))
    $pen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(90, 160, 60)), 8
    $g.DrawBezier($pen, 10, 90, 50, 20, 100, 110, 150, 40)   # "con ran" don gian
    $pen.Dispose(); $g.Dispose()
    $bmp.Save($Path, $Format)
    $bmp.Dispose()
}

New-SampleImage (Join-Path $dir 'snake.jpg') ([System.Drawing.Imaging.ImageFormat]::Jpeg)
New-SampleImage (Join-Path $dir 'not-jpeg.png') ([System.Drawing.Imaging.ImageFormat]::Png)
Get-ChildItem $dir -Filter '*.*g' | Select-Object Name, Length
