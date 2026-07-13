@echo off
chcp 65001 > nul
title 客服抽籤工具 本地伺服器
echo ===================================================
echo   🎯 客服抽籤工具 - 本地開發伺服器 啟動中...
echo ===================================================
echo   說明：由於瀏覽器安全限制，錄影功能 (getDisplayMedia)
echo   必須在安全環境 (localhost) 下運行。直接開啟 index.html
echo   會使錄影功能失效。
echo ---------------------------------------------------
echo   伺服器運行網址：http://localhost:8080/
echo   提示：關閉此視窗即可停止伺服器。
echo ===================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $port = 8080; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:' + $port + '/'); try { $listener.Start() } catch { Write-Host '啟動失敗，請確認 8080 端口是否被佔用。'; Write-Host $_.Exception.Message; pause; exit }; Start-Process ('http://localhost:' + $port + '/'); while ($listener.IsListening) { try { $context = $listener.GetContext(); $req = $context.Request; $res = $context.Response; $path = $req.Url.LocalPath; if ($path -eq '/') { $path = '/index.html' }; $local = Join-Path (Get-Location) $path.TrimStart('/'); if (Test-Path $local -PathType Leaf) { $bytes = [System.IO.File]::ReadAllBytes($local); $ext = [System.IO.Path]::GetExtension($local).ToLower(); $mime = 'text/plain'; if ($ext -eq '.html') { $mime = 'text/html; charset=utf-8' } elseif ($ext -eq '.css') { $mime = 'text/css' } elseif ($ext -eq '.js') { $mime = 'application/javascript' } elseif ($ext -eq '.png') { $mime = 'image/png' } elseif ($ext -eq '.webm') { $mime = 'video/webm' }; $res.ContentType = $mime; $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length) } else { $res.StatusCode = 404 }; $res.Close() } catch {} } }"
