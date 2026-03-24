// Simple routing demo (mock) — picks a model from workspace-level .model_routing.json
const fs = require('fs');
const path = require('path');

function loadRouting(){
  const p = path.resolve(process.cwd(), '../../../../.model_routing.json');
  if(!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p,'utf8'));
}

function chooseModelForIntent(intent, routing){
  if(!routing) return 'openai/gpt-5.4';
  const mapping = routing.intents || {};
  return mapping[intent] || routing.router.model;
}

function demo(){
  const routing = loadRouting();
  console.log('Routing loaded:', !!routing);
  const intents = ['chat','research','code_simple','debugging'];
  for(const i of intents){
    console.log(`Intent: ${i} -> model: ${chooseModelForIntent(i,routing)}`);
  }
}

if(require.main===module) demo();
module.exports = { demo };
