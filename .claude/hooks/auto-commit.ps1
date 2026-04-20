# DeckFarm — Auto-commit & push hook
# Runs at the end of every Claude Code turn (Stop hook).
# Commits any staged/unstaged changes and pushes to origin/main.

Set-Location $env:CLAUDE_PROJECT_DIR

# Check if there are any changes at all
$status = git status --porcelain 2>$null
if (-not $status) { exit 0 }   # nothing to commit — silent exit

# Stage every modified tracked file (excludes untracked secrets like .env*)
git add --update

# Re-check after staging (untracked-only changes would still be empty)
$staged = git diff --cached --quiet; $exitCode = $LASTEXITCODE
if ($exitCode -eq 0) { exit 0 }  # nothing staged

# Build commit message: short summary + file list
$files = (git diff --cached --name-only) -join ", "
$msg = "chore: auto-save session changes`n`nFiles: $files`n`nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git commit -m $msg
if ($LASTEXITCODE -ne 0) { exit 1 }

git push origin main
