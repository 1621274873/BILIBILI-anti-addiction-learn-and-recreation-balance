Add-Type -AssemblyName System.Drawing

$assetDirectory = Join-Path $PSScriptRoot "..\assets"
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null

foreach ($size in 16, 32, 48, 128) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(31, 95, 82))

  $ringPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(239, 246, 241)), ([Math]::Max(1.5, $size * 0.07))
  $margin = [Math]::Max(2.0, $size * 0.18)
  $graphics.DrawEllipse($ringPen, $margin, $margin, $size - ($margin * 2), $size - ($margin * 2))

  $handPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(239, 246, 241)), ([Math]::Max(1.2, $size * 0.055))
  $center = $size / 2
  $graphics.DrawLine($handPen, $center, $center, $center, $size * 0.32)
  $graphics.DrawLine($handPen, $center, $center, $size * 0.68, $center + ($size * 0.08))

  $bitmap.Save((Join-Path $assetDirectory "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $handPen.Dispose()
  $ringPen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
