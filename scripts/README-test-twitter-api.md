# Test Twitter API (key from env file)

Do **not** run `Invoke-RestMethod ... -Headers $h` by itself — `$h` is never set, so you get "Object reference not set".

Use the script instead (it reads the key from `apps/web/.env.local`):

```powershell
# 1. Go to repo root
cd c:\Users\Muaz\Desktop\Linkary

# 2. Run the script (one of these)
.\scripts\test-twitter-api.ps1
.\scripts\test-twitter-api.ps1 -Endpoint info
.\scripts\test-twitter-api.ps1 -UserName muazxinthi -Endpoint last_tweets
```

One-liner from anywhere (replace path if your repo is elsewhere):

```powershell
Set-Location c:\Users\Muaz\Desktop\Linkary; .\scripts\test-twitter-api.ps1
```
