# Runs the daily pipeline and pushes the new solution to GitHub, if any.
# Intended to be run unattended (Windows Task Scheduler) — everything that
# happens is appended to logs\daily_run.log since there's no console to watch.
#
# Deliberately does NOT use $ErrorActionPreference = "Stop": git writes its
# normal, successful push output to stderr, and Stop + stderr-redirecting a
# native command wraps every stderr line as an error and aborts even on
# exit code 0. Exit codes are checked explicitly instead, which is reliable
# regardless of which stream a native command writes to.

$projectDir = "G:\My Drive\pro\puzzleSolver"
$logFile = Join-Path $projectDir "logs\daily_run.log"

Set-Location $projectDir
New-Item -ItemType Directory -Path (Join-Path $projectDir "logs") -Force | Out-Null

"=== Run started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -Append $logFile -Encoding utf8

& ".\venv\Scripts\python.exe" main.py 2>&1 | Out-File -Append $logFile -Encoding utf8
if ($LASTEXITCODE -ne 0) {
    "=== Run FAILED: main.py exited with code $LASTEXITCODE ===" | Out-File -Append $logFile -Encoding utf8
    exit 1
}

git add site/solutions/*.json 2>&1 | Out-File -Append $logFile -Encoding utf8
git diff --staged --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "Add solution for $(Get-Date -Format yyyy-MM-dd)" 2>&1 | Out-File -Append $logFile -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        "=== Run FAILED: git commit exited with code $LASTEXITCODE ===" | Out-File -Append $logFile -Encoding utf8
        exit 1
    }

    git push 2>&1 | Out-File -Append $logFile -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        "=== Run FAILED: git push exited with code $LASTEXITCODE ===" | Out-File -Append $logFile -Encoding utf8
        exit 1
    }
    "Pushed new solution." | Out-File -Append $logFile -Encoding utf8
} else {
    "No changes to commit." | Out-File -Append $logFile -Encoding utf8
}

"=== Run succeeded: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -Append $logFile -Encoding utf8
