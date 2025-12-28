Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "C:\path\to\launch_app.bat" & Chr(34), 0
Set WshShell = Nothing
