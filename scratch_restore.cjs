const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\Win10\\.gemini\\antigravity\\brain\\5d8836fd-1465-4b72-abe0-3fe83fb5a9dd\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 504) {
      const toolCall = obj.tool_calls[0];
      console.log("KEYS:", Object.keys(toolCall.args));
      console.log("RAW CHUNKS:", typeof toolCall.args.ReplacementChunks, toolCall.args.ReplacementChunks ? toolCall.args.ReplacementChunks.substring(0, 500) : "undefined");
    }
  } catch (err) {
    console.error("LINE ERR:", err);
  }
});
