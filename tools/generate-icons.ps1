# 生成扩展图标：16 / 32 / 48 / 128
#
# 形状取自 assets/logo.svg（512 基准坐标系），用 System.Drawing 逐个绘制。
# 【本脚本不渲染 SVG】，只是按同一套坐标重画一遍 —— 改动 assets/logo.svg 后需要同步这里的坐标。
#
# 为什么手写而不用图标生成工具：本仓库不引入构建步骤、不安装 npm 包（见 AGENTS.md），
# System.Drawing 是 Windows 自带能力，零依赖。
#
# 小尺寸取舍：16px 下四角括号的厚度只有 22/512 ≈ 0.69px，会退化成亚像素噪点，
# 所以 size < 32 时只画「圆角底 + 屏幕 + 播放三角」这层主体。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/generate-icons.ps1

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$script:Base = 512.0
$script:Size = 128

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $repoRoot "icons"
$sizes = @(16, 32, 48, 128)

function S([double]$value) {
  return [float]($script:Size * $value / $script:Base)
}

function New-RoundedRect([double]$x, [double]$y, [double]$w, [double]$h, [double]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = (S $r) * 2
  $left = S $x
  $top = S $y
  $width = S $w
  $height = S $h

  $path.AddArc($left, $top, $diameter, $diameter, 180, 90)
  $path.AddArc($left + $width - $diameter, $top, $diameter, $diameter, 270, 90)
  $path.AddArc($left + $width - $diameter, $top + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($left, $top + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

function New-FlatPolygon([double[]]$flat) {
  $count = [int]($flat.Length / 2)
  $points = [System.Drawing.PointF[]]::new($count)

  for ($i = 0; $i -lt $count; $i++) {
    $points[$i] = [System.Drawing.PointF]::new((S $flat[$i * 2]), (S $flat[$i * 2 + 1]))
  }

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddPolygon($points)

  return $path
}

function New-SolidBrush([string]$hex, [int]$alpha = 255) {
  $base = [System.Drawing.ColorTranslator]::FromHtml($hex)
  return New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, $base))
}

function New-LinePen([string]$hex, [double]$width) {
  $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), (S $width))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

foreach ($size in $sizes) {
  $script:Size = $size
  $detailed = $size -ge 32

  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  $disposables = @()
  $bracketPaths = @()

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    # 底：圆角方块 + 深蓝到青的斜向渐变
    $bgPath = New-RoundedRect 32 32 448 448 104
    $disposables += $bgPath
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.PointF]::new((S 56), (S 52))),
      ([System.Drawing.PointF]::new((S 456), (S 460))),
      ([System.Drawing.ColorTranslator]::FromHtml("#0F172A")),
      ([System.Drawing.ColorTranslator]::FromHtml("#0B5D7A"))
    )
    $disposables += $bgBrush
    $graphics.FillPath($bgBrush, $bgPath)

    # 屏幕外框
    $screenPath = New-RoundedRect 86 110 292 208 42
    $disposables += $screenPath
    $screenFill = New-SolidBrush "#E6FBFF" 41
    $screenPen = New-LinePen "#7DE3FF" 8
    $disposables += $screenFill
    $disposables += $screenPen
    $graphics.FillPath($screenFill, $screenPath)
    $graphics.DrawPath($screenPen, $screenPath)

    # 播放区
    $playPath = New-RoundedRect 122 144 220 140 24
    $disposables += $playPath
    $playBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.PointF]::new((S 124), (S 112))),
      ([System.Drawing.PointF]::new((S 368), (S 352))),
      ([System.Drawing.ColorTranslator]::FromHtml("#7DE3FF")),
      ([System.Drawing.ColorTranslator]::FromHtml("#D8FAFF"))
    )
    $disposables += $playBrush
    $graphics.FillPath($playBrush, $playPath)

    # 播放三角
    # 等比缩放下三角在 16px 只剩约 2px，读不出来；所以 <32 时按 1.6 倍放大后再画，
    # 顶点仍落在播放区（122..342 × 144..284）内部。
    $trianglePoints = @(214, 182.5, 286, 211.7, 214, 240.9)
    if (-not $detailed) {
      $trianglePoints = @(199.6, 165, 314.8, 211.7, 199.6, 258.4)
    }
    $triangle = New-FlatPolygon -flat $trianglePoints
    $triangleFill = New-SolidBrush "#0F172A"
    $disposables += $triangle
    $disposables += $triangleFill
    $graphics.FillPath($triangleFill, $triangle)

    if ($detailed) {
      # 右侧控制条
      $barPath = New-RoundedRect 396 168 42 176 21
      $disposables += $barPath
      $barFill = New-SolidBrush "#E6FBFF" 46
      $barPen = New-LinePen "#9EE8FF" 8
      $disposables += $barFill
      $disposables += $barPen
      $graphics.FillPath($barFill, $barPath)
      $graphics.DrawPath($barPen, $barPath)

      # 控制条上的三个圆点
      $dotBrush = New-SolidBrush "#9EE8FF"
      $disposables += $dotBrush
      foreach ($cy in @(218, 256, 294)) {
        $graphics.FillEllipse($dotBrush, (S (417 - 8)), (S ($cy - 8)), (S 16), (S 16))
      }

      # 四角手柄括号
      $bracketBrush = New-SolidBrush "#F8FAFC"
      $disposables += $bracketBrush
      $corners = @(
        @(110, 118, 110, 168, 132, 168, 132, 140, 160, 140, 160, 118),
        @(402, 118, 352, 118, 352, 140, 380, 140, 380, 168, 402, 168),
        @(110, 394, 160, 394, 160, 372, 132, 372, 132, 344, 110, 344),
        @(402, 394, 402, 344, 380, 344, 380, 372, 352, 372, 352, 394)
      )
      foreach ($corner in $corners) {
        $path = New-FlatPolygon -flat $corner
        $bracketPaths += $path
        $graphics.FillPath($bracketBrush, $path)
      }
    }

    $targetPath = Join-Path $outputDir ("icon{0}.png" -f $size)
    $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $mode = if ($detailed) { "detailed" } else { "simplified" }
    Write-Host "generated icon$size.png ($size px, $mode)"
  }
  finally {
    foreach ($item in ($disposables + $bracketPaths)) {
      if ($item) { $item.Dispose() }
    }
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

Write-Host "icons written to $outputDir"
