/**
 * Clawsidian configuration management.
 * Config lives at ~/.config/clawsidian/config.json
 * 
 * Priority: CLI flags > env vars > config file > defaults
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'clawsidian');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  vault: join(homedir(), 'openclaw/obsidian-vault'),
  summarize: true,
  summaryModel: 'gpt-4.1-mini',
  openaiApiKey: null,
  openaiBaseUrl: 'https://api.openai.com/v1',
};

/**
 * Load config from file, merging with defaults.
 */
export async function loadConfig() {
  let fileConfig = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = await readFile(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch {
      // Corrupted config — use defaults
    }
  }

  return { ...DEFAULTS, ...fileConfig };
}

/**
 * Save config to file.
 */
export async function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  // Don't persist defaults that match — keep config clean
  const toSave = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== DEFAULTS[key]) {
      toSave[key] = value;
    }
  }
  await writeFile(CONFIG_PATH, JSON.stringify(toSave, null, 2) + '\n', 'utf-8');
  return CONFIG_PATH;
}

/**
 * Resolve effective config: CLI flags > env vars > config file > defaults
 */
export async function resolveConfig(cliValues = {}) {
  const config = await loadConfig();

  // Env var overrides
  if (process.env.OPENAI_API_KEY) {
    config.openaiApiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.OPENAI_BASE_URL) {
    config.openaiBaseUrl = process.env.OPENAI_BASE_URL;
  }
  if (process.env.CLAWSIDIAN_VAULT) {
    config.vault = process.env.CLAWSIDIAN_VAULT;
  }

  // CLI overrides
  if (cliValues.vault) config.vault = cliValues.vault;
  if (cliValues['no-summary']) config.summarize = false;

  return config;
}

/**
 * Detect what's available in the current environment.
 * Used by `clawsidian init` to auto-configure.
 */
export async function detectEnvironment() {
  const detected = {
    openaiKey: false,
    openaiKeySource: null,
    anthropicKey: false,
    obsidianInstalled: false,
    obsidianCli: false,
    vaultPath: null,
    openclawRunning: false,
  };

  // Check for API keys
  if (process.env.OPENAI_API_KEY) {
    detected.openaiKey = true;
    detected.openaiKeySource = 'environment variable';
  }
  if (process.env.ANTHROPIC_API_KEY) {
    detected.anthropicKey = true;
  }

  // Check for Obsidian app
  const obsidianConfigPath = join(homedir(), 'Library/Application Support/obsidian/obsidian.json');
  if (existsSync(obsidianConfigPath)) {
    detected.obsidianInstalled = true;
    try {
      const raw = await readFile(obsidianConfigPath, 'utf-8');
      const obsConfig = JSON.parse(raw);
      // Find open vaults
      if (obsConfig.vaults) {
        const vaults = Object.values(obsConfig.vaults);
        const openVault = vaults.find(v => v.open);
        if (openVault?.path) {
          detected.vaultPath = openVault.path;
        } else if (vaults.length === 1 && vaults[0].path) {
          detected.vaultPath = vaults[0].path;
        }
      }
    } catch {
      // Can't parse — that's fine
    }
  }

  // Check for obsidian-cli
  try {
    const { execSync } = await import('node:child_process');
    execSync('which obsidian-cli', { stdio: 'ignore' });
    detected.obsidianCli = true;
  } catch {
    // Not installed
  }

  // Check for OpenClaw
  try {
    const { execSync } = await import('node:child_process');
    execSync('openclaw gateway status 2>/dev/null | grep -q "running"', { stdio: 'ignore' });
    detected.openclawRunning = true;
  } catch {
    // Not running or not installed
  }

  return detected;
}

export { CONFIG_PATH, CONFIG_DIR, DEFAULTS };
