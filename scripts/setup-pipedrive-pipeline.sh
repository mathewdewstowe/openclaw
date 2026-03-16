#!/bin/bash
# setup-pipedrive-pipeline.sh
# Run this once with a valid Pipedrive API key to create the Sonesse pipeline + stages
# Usage: PIPEDRIVE_TOKEN=your_token bash setup-pipedrive-pipeline.sh

PIPEDRIVE_KEY="${PIPEDRIVE_TOKEN:-404d1d1701fbe3462d0c5ba9626b6383e1ecdfa3}"
STAGES_FILE="/home/matthewdewstowe/.openclaw/workspace/memory/pipedrive-stages.json"

echo "🔍 Checking existing pipelines..."
PIPELINES=$(curl -s "https://api.pipedrive.com/v1/pipelines?api_token=$PIPEDRIVE_KEY")
echo "$PIPELINES" | python3 -m json.tool | head -40

# Check if Sonesse Outbound exists
PIPELINE_ID=$(echo "$PIPELINES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data.get('data', []) or []:
    if 'Sonesse' in p.get('name','') or 'Nth Layer' in p.get('name',''):
        print(p['id'])
        break
" 2>/dev/null)

if [ -z "$PIPELINE_ID" ]; then
    echo "📋 Creating Sonesse Outbound pipeline..."
    RESULT=$(curl -s -X POST "https://api.pipedrive.com/v1/pipelines?api_token=$PIPEDRIVE_KEY" \
      -H "Content-Type: application/json" \
      -d '{"name": "Sonesse Outbound", "deal_probability": true}')
    PIPELINE_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
    echo "✅ Created pipeline ID: $PIPELINE_ID"
else
    echo "✅ Found existing pipeline ID: $PIPELINE_ID"
fi

# Create stages
declare -A STAGE_PROBS=(
    ["In Sequence"]=10
    ["Opened Email"]=20
    ["Replied - Interested"]=40
    ["Meeting Booked"]=60
    ["Proposal Sent"]=70
    ["Closed Won"]=100
    ["Closed Lost"]=0
)

declare -A STAGE_IDS

for STAGE_NAME in "In Sequence" "Opened Email" "Replied - Interested" "Meeting Booked" "Proposal Sent" "Closed Won" "Closed Lost"; do
    PROB="${STAGE_PROBS[$STAGE_NAME]}"
    echo "Creating stage: $STAGE_NAME (prob: $PROB%)..."
    RESULT=$(curl -s -X POST "https://api.pipedrive.com/v1/stages?api_token=$PIPEDRIVE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$STAGE_NAME\", \"pipeline_id\": $PIPELINE_ID, \"deal_probability\": $PROB}")
    STAGE_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
    STAGE_IDS["$STAGE_NAME"]=$STAGE_ID
    echo "  → Stage ID: $STAGE_ID"
    sleep 0.5
done

# Write stages file
python3 << PYEOF
import json

pipeline_id = $PIPELINE_ID
stages = {
$(for STAGE_NAME in "In Sequence" "Opened Email" "Replied - Interested" "Meeting Booked" "Proposal Sent" "Closed Won" "Closed Lost"; do
    echo "    \"$STAGE_NAME\": ${STAGE_IDS[$STAGE_NAME]},"
done)
}

config = {
    "_status": "configured",
    "pipeline_id": pipeline_id,
    "pipeline_name": "Sonesse Outbound",
    "stages": stages,
    "stage_probabilities": {
        "In Sequence": 10,
        "Opened Email": 20,
        "Replied - Interested": 40,
        "Meeting Booked": 60,
        "Proposal Sent": 70,
        "Closed Won": 100,
        "Closed Lost": 0
    }
}

with open("$STAGES_FILE", "w") as f:
    json.dump(config, f, indent=2)

print("✅ Saved to $STAGES_FILE")
print(json.dumps(config, indent=2))
PYEOF

echo ""
echo "🎉 Done! Pipeline configured. Apollo poller will now create deals automatically."
