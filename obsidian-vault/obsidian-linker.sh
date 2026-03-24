#!/bin/zsh

VAULT="/Users/nigel/.openclaw/workspace/obsidian-vault"
TOPICS="$VAULT/Topics"

TOPIC_NAMES=()
for f in "$TOPICS"/*.md; do
 TOPIC_NAMES+=("$(basename "$f" .md)")
done

for file in $(find "$VAULT" -type f -name "*.md"); do
 [[ "$file" == *"/Topics/"* ]] && continue

 if grep -q "^---\n## See Also" "$file"; then
   continue
 fi

 MATCHES=()
 CONTENT=$(cat "$file")

 for topic in "${TOPIC_NAMES[@]}"; do
   echo "$CONTENT" | grep -qi "$topic" && MATCHES+=("$topic")
 done

 if [ ${#MATCHES[@]} -gt 0 ]; then
   echo "\n\n---\n## See Also" >> "$file"
   for m in "${MATCHES[@]}"; do
     echo "- [[${m}]]" >> "$file"
   done
 else
   echo "\n\n---\n## See Also\n<!-- No matching topics -->" >> "$file"
 fi
done
