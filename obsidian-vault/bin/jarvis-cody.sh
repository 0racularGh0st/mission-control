#!/bin/zsh
# jarvis-cody: local coding wrapper using OpenAI CLI (requires openai CLI & API key)
# Usage: jarvis-cody.sh "<task description>"

TASK="$*"
if [ -z "$TASK" ]; then
  echo "Usage: $0 \"Describe the coding task\""
  exit 1
fi

if command -v openai >/dev/null 2>&1; then
  openai chat.completions.create -m openai/gpt-5-mini -r "You are Cody, a concise professional coding assistant. For the user task, produce: 1) a short plan, 2) the code (files), 3) tests, 4) exact run commands. Do not perform destructive actions.\nUser task: $TASK" --stream
else
  echo "OpenAI CLI not found. Install it and set OPENAI_API_KEY, or ask me to run Cody for you." 
  echo "Install: https://platform.openai.com/docs/cli/installation"
  exit 2
fi
