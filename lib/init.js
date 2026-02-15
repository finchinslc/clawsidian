/**
 * `clawsidian init` — Interactive setup that detects your environment.
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
  console.log(`    obsidian-cli:     ${env.obsidianCli ? '✅ installed' : '⚠️  not installed (optional — brew install yakitrak/yakitrak/obsidian-cli)'}`);
  console.log(`    OpenClaw:         ${env.openclawRunning ? '✅ running' : '⚠️  not detected (optional)'}`);
  console.log(`    OpenAI API key:   ${env.openaiKey ? `✅ found (${env.openaiKeySource})` : '❌ not found'}`);
  if (env.vaultPath) {
    console.log(`    Detected vault:   ${env.vaultPath}`);
  }
  console.log('');

  if (nonInteractive) {
    // Auto-configure from detected environment
    config.vault = resolve(env.vaultPath || config.vault || DEFAULTS.vault);
    config.summarize = env.openaiKey;
    if (!config.summaryModel) config.summaryModel = DEFAULTS.summaryModel;

    const configPath = await saveConfig(config);
    console.log(`  ✅ Auto-configured from detected environment.`);
    console.log(`  ✅ Config saved to ${configPath}`);
    console.log(`     Vault:      ${config.vault}`);
    console.log(`     Summaries:  ${config.summarize ? `enabled (${config.summaryModel})` : 'disabled (no API key)'}`);
    console.log('');
    console.log('  Run `clawsidian init` interactively to customize.');
    console.log('');
    return config;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suggestedVault = env.vaultPath || config.vault || DEFAULTS.vault;
  const vaultAnswer = await ask(rl, `  Vault path [${suggestedVault}]: `);
  const vaultPath = vaultAnswer.trim() || suggestedVault;
  config.vault = resolve(vaultPath);

  if (!existsSync(config.vault)) {
    const create = await ask(rl, `  Vault directory doesn't exist. Create it? [Y/n]: `);
    if (create.trim().toLowerCase() !== 'n') {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(config.vault, { recursive: true });
      console.log(`  ✅ Created ${config.vault}`);
    }
  }

  // --- Summarization ---
  console.log('');
  console.log('  Summarization:');
  if (env.openaiKey) {
    console.log('    OpenAI key detected — summaries will work automatically.');
    const summaryAnswer = await ask(rl, `  Enable auto-summaries on save? [Y/n]: `);
    config.summarize = summaryAnswer.trim().toLowerCase() !== 'n';
  } else {
    console.log('    No OpenAI API key found. Summaries need one to work.');
    const keyAnswer = await ask(rl, '  Enter OpenAI API key (or press Enter to skip): ');
    if (keyAnswer.trim()) {
      config.openaiApiKey = keyAnswer.trim();
      config.summarize = true;
      console.log('  ✅ Key saved to config (not in env — only clawsidian uses it).');
    } else {
      config.summarize = false;
      console.log('  ⚠️  Summaries disabled. Add a key later with: clawsidian init');
    }
  }

  // --- Summary model ---
  if (config.summarize) {
    const modelAnswer = await ask(rl, `  Summary model [${config.summaryModel || DEFAULTS.summaryModel}]: `);
    if (modelAnswer.trim()) {
      config.summaryModel = modelAnswer.trim();
    }
  }

  // --- Save ---
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
