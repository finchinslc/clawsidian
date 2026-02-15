/**
 * `clawsidian init` — Auto-detect environment and configure.
 */

import { createInterface } from 'node:readline';
import { detectEnvironment, saveConfig, loadConfig, DEFAULTS, CONFIG_PATH } from './config.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function ask(rl, question) {
  return new Promise(res => rl.question(question, res));
}

export async function runInit(nonInteractive = false) {
  console.log('\n🔧 Clawsidian Setup\n');
  console.log('Detecting your environment...\n');

  const env = await detectEnvironment();
  const config = await loadConfig();

  // --- Report what we found ---
  console.log('  Environment:');
  console.log(`    Obsidian app:     ${env.obsidianInstalled ? '✅ installed' : '❌ not found'}`);
  console.log(`    obsidian-cli:     ${env.obsidianCli ? '✅ installed' : '⚠️  not installed (optional)'}`);
  console.log(`    OpenClaw:         ${env.openclawRunning ? '✅ running' : '⚠️  not detected'}`);
  console.log(`    OpenClaw config:  ${env.openclawConfig ? '✅ found' : '❌ not found'}`);

  if (env.providers.length > 0) {
    console.log(`    AI providers:     ✅ ${env.providers.map(p => `${p.name} (${p.source})`).join(', ')}`);
    console.log(`    Summarization:    ✅ ${env.bestProvider.name} — ${env.bestProvider.model}`);
  } else {
    console.log(`    AI providers:     ❌ none found`);
    console.log(`    Summarization:    ❌ disabled (no API keys)`);
  }

  if (env.vaultPath) {
    console.log(`    Vault:            ${env.vaultPath}`);
  }
  console.log('');

  // --- Auto-configure ---
  config.vault = resolve(env.vaultPath || config.vault || DEFAULTS.vault);

  if (env.bestProvider) {
    config.summarize = true;
    config.summaryModel = env.bestProvider.model;
    config.openaiBaseUrl = env.bestProvider.baseUrl;
    config.apiKeyEnv = env.bestProvider.envVar;
  } else {
    config.summarize = false;
  }

  if (nonInteractive) {
    const configPath = await saveConfig(config);
    console.log(`  ✅ Config saved to ${configPath}`);
    console.log('');
    return config;
  }

  // --- Interactive: just confirm ---
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const vaultAnswer = await ask(rl, `  Vault path [${config.vault}]: `);
  if (vaultAnswer.trim()) {
    config.vault = resolve(vaultAnswer.trim());
  }

  if (!existsSync(config.vault)) {
    const create = await ask(rl, `  Vault doesn't exist. Create it? [Y/n]: `);
    if (create.trim().toLowerCase() !== 'n') {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(config.vault, { recursive: true });
      console.log(`  ✅ Created ${config.vault}`);
    }
  }

  if (!env.bestProvider) {
    console.log('');
    console.log('  No API keys found in your environment or OpenClaw config.');
    console.log('  Summaries will be disabled. To enable them, add an API key');
    console.log('  to your OpenClaw config or environment, then run init again.');
  }

  console.log('');
  const configPath = await saveConfig(config);
  console.log(`  ✅ Config saved to ${configPath}`);
  console.log('');
  console.log('  Setup complete! Try it out:');
  console.log('    clawsidian save "https://example.com/article"');
  console.log('');

  rl.close();
  return config;
}
