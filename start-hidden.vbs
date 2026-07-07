Set WShell = CreateObject("WScript.Shell")
WShell.Run "cmd /c C:\Users\User\AppData\Roaming\npm\pm2.cmd resurrect", 0, False
