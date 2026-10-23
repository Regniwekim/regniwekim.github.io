import { initializeSandbox } from './ui/sandbox.js';
import { createGameStartup } from './ui/startup.js';
import { loadGameplayVocabulary } from './vocabulary/loader.js';

const startup = createGameStartup({
  container: document.getElementById('game'),
  status: document.getElementById('vocabulary-status'),
  retry: document.getElementById('retry-vocabulary'),
  load: loadGameplayVocabulary,
  start: initializeSandbox,
});
startup.start();
