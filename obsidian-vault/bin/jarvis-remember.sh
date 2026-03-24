#!/bin/zsh
VAULT="/Users/nigel/.openclaw/workspace/obsidian-vault"
TODAY=$(date +%F)
DAILY="$VAULT/daily/$TODAY.md"
mkdir -p "$VAULT/daily"
if [ ! -f "$DAILY" ]; then
  echo "---\ntags: daily\ndate: $TODAY\n---\n\n# Daily Note — $TODAY\n" > "$DAILY"
fi
echo "- $(date +"%H:%M") $* #session-log" >> "$DAILY"
echo "Appended to $DAILY"