#!/usr/bin/env bash
# apply-with-codegen.sh — Launch a job application with Playwright codegen recording
# Usage: ./apply-with-codegen.sh <linkedin_job_id> [job_title] [company]
# Example: ./apply-with-codegen.sh 4272101995 "VP of AI" "Cleo"
#
# This script:
# 1. Opens the job URL in Chrome (you apply manually)
# 2. Runs codegen in parallel to record every action
# 3. Saves the generated code to jobs/codegen-recordings/<job_id>.js
# 4. Watches for you to close codegen window (= application done)
# 5. Logs the recording path so future apply runs can use learned patterns

JOB_ID="${1}"
JOB_TITLE="${2:-Unknown Role}"
COMPANY="${3:-Unknown Company}"

if [ -z "$JOB_ID" ]; then
  echo "Usage: $0 <linkedin_job_id> [job_title] [company]"
  exit 1
fi

JOB_URL="https://www.linkedin.com/jobs/view/${JOB_ID}/?codegen=1"
RECORDINGS_DIR="/home/matthewdewstowe/.openclaw/workspace/jobs/codegen-recordings"
mkdir -p "$RECORDINGS_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="${RECORDINGS_DIR}/${TIMESTAMP}_${JOB_ID}_$(echo "$COMPANY" | tr ' ' '_' | tr -cd '[:alnum:]_-').js"
LOG_FILE="${RECORDINGS_DIR}/${TIMESTAMP}_${JOB_ID}.json"

echo ""
echo "🎬 Starting codegen session"
echo "   Job: $JOB_TITLE @ $COMPANY"
echo "   ID:  $JOB_ID"
echo "   URL: $JOB_URL"
echo "   Recording to: $OUTPUT_FILE"
echo ""
echo "📋 Instructions:"
echo "   1. A browser window will open to the job page"
echo "   2. Click 'Easy Apply' and fill the form normally"
echo "   3. Submit the application"
echo "   4. CLOSE the codegen inspector window when done"
echo "   5. This script will detect the close and save everything"
echo ""

# Launch codegen — it opens its own browser + inspector window
# --output writes the generated code to our file
# --load-storage loads your LinkedIn session cookies
cd /home/matthewdewstowe/.openclaw/workspace/jobs

PROFILE_DIR="/home/matthewdewstowe/.openclaw/workspace/jobs/codegen-profile"
mkdir -p "$PROFILE_DIR"

# Check if we have a saved session
if [ -f "$PROFILE_DIR/state.json" ]; then
  echo "🔐 Reusing saved LinkedIn session (no login needed)"
  STORAGE_ARG="--load-storage=$PROFILE_DIR/state.json"
else
  echo "🔐 No saved session found — you'll need to log in once"
  echo "   After logging in, your session will be saved for future jobs"
  STORAGE_ARG=""
fi

echo "🎬 Codegen starting — apply to the job, then close the inspector window..."
echo ""

# Run codegen — blocks until the inspector window is closed
npx playwright codegen \
  $STORAGE_ARG \
  --save-storage="$PROFILE_DIR/state.json" \
  --output="$OUTPUT_FILE" \
  "$JOB_URL" 2>/dev/null

EXIT_CODE=$?
DONE_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo ""
echo "✅ Codegen session ended (exit $EXIT_CODE)"

# Save metadata log
cat > "$LOG_FILE" << JSON
{
  "jobId": "$JOB_ID",
  "jobTitle": "$JOB_TITLE",
  "company": "$COMPANY",
  "url": "$JOB_URL",
  "recordedAt": "$DONE_AT",
  "outputFile": "$OUTPUT_FILE",
  "exitCode": $EXIT_CODE
}
JSON

if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
  LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
  echo "📄 Recording saved: $OUTPUT_FILE ($LINE_COUNT lines)"
  echo ""
  echo "First 30 lines of captured code:"
  echo "---"
  head -30 "$OUTPUT_FILE"
  echo "---"
  echo ""
  echo "📊 Sending summary to Slack..."
  
  # Extract what fields were filled (grep for fill/type/click patterns)
  FIELDS=$(grep -E "fill|type|select|check|click" "$OUTPUT_FILE" 2>/dev/null | grep -v "//" | head -20 | sed "s/'/\\\'/g" | tr '\n' '|')
  
  openclaw agent \
    --message "Job application recorded via codegen. Job: $JOB_TITLE @ $COMPANY (ID: $JOB_ID). Recording saved to: $OUTPUT_FILE. $([ $EXIT_CODE -eq 0 ] && echo 'Application likely completed.' || echo 'Session ended early.') Send a brief Slack message to channel:C0ALLLM2DBP confirming the recording was saved and asking Matthew to confirm if the application was submitted." \
    --session isolated \
    --channel slack \
    2>/dev/null &

  echo "✅ All done. Recording saved and Slack notified."
else
  echo "⚠️  No recording file created (window closed before any actions?)"
fi
