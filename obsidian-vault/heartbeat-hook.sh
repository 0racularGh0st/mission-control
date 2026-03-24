#!/bin/zsh
# Simple heartbeat hook: gather gateway status and append a short summary to today's note
STATUS=$(openclaw gateway status 2>&1 | sed -n '1,12p')
/Users/nigel/.openclaw/workspace/obsidian-vault/bin/jarvis-remember.sh "Heartbeat: $(echo "$STATUS" | head -n 3 | tr '\n' ' ' )"
