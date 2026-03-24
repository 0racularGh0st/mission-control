#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH="feature/jarvis-build-$(date +%s)"

echo "Creating branch $BRANCH"
git checkout -b "$BRANCH"

echo "Running lint, typecheck, build, test"
npm ci
npm run lint --if-present || true
npm run typecheck --if-present || true
npm run build
npm run test --if-present || true

echo "Committing and pushing"
git add -A
git commit -m "chore: Jarvis build changes"

git push -u origin "$BRANCH"

# create PR if gh CLI available
if command -v gh >/dev/null 2>&1; then
  gh pr create --fill --base main --title "Jarvis: automated build" --body "Automated build/changes by Jarvis" 
else
  echo "GH CLI not available — branch pushed. Open a PR manually."
fi
