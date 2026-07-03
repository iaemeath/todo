const webllm = require('@mlc-ai/web-llm');
console.log('--- ALL KEYS ---');
console.log(Object.keys(webllm));

console.log('--- MODELS ---');
if (webllm.prebuiltAppConfig) {
  console.log(webllm.prebuiltAppConfig.model_list.map(m => m.model_id).slice(0, 10));
}
