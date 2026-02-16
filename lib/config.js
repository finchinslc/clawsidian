/**
 * Clawsidian configuration management.
 * Config lives at ~/.config/clawsidian/config.json
 *
 * Auto-detects API keys from OpenClaw config and environment.
 * Priority: CLI flags > env vars > OpenClaw config > config file > defaults
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'clawsidian');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json');

const DEFAULTS = {
  vault: join(homedir(), 'openclaw/obsidian-vault'),
  summarize: true,
  summaryModel: null,
  openaiBaseUrl: null,
  apiKeyEnv: null,
};

// Providers ordered by preference for summarization (cheapest/fastest first)
const PROVIDERS = [
  { env: 'OPENAI_API_KEY', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-nano' },
  { env: 'GEMINI_API_KEY', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { env: 'OPENROUTER_API_KEY', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.0-flash-exp' },
  { env: 'XAI_API_KEY', name: 'xAI', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini' },
  { env: 'ANTHROPIC_API_KEY', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-haiku-4' },
];

/**
 * Read API keys from OpenClaw's config file.
 * Only reads the env block — no secrets beyond what the user already configured.
 */
async function readOpenClawKeys() {
  if (!existsSync(OPENCLAW_CONFIG)) return {};
  try {
    const raw = await readFile(OPENCLAW_CONFIG, 'utf-8');
    const config = JSON.parse(raw);
    return config.env || {};
  } catch {
    return {};
  }
}

/**
 * Find the best available provider by checking env vars + OpenClaw config.
 * Returns { name, baseUrl, model, apiKey, envVar } or null.
 */
export async function findBestProvider() {
  const openclawEnv = await readOpenClawKeys();

  for (const provider of PROVIDERS) {
    // Check process env first, then OpenClaw config
    const key = process.env[provider.env] || openclawEnv[provider.env];
    if (key) {
      return {
        name: provider.name,
        baseUrl: provider.baseUrl,
        model: provider.model,
        apiKey: key,
        envVar: provider.env,
      };
    }
  }
  return null;
}

/**
 * List all available providers.
 */
export async function listAvailableProviders() {
  const openclawEnv = await readOpenClawKeys();
  const available = [];

  for (const provider of PROVIDERS) {
    const key = process.env[provider.env] || openclawEnv[provider.env];
    if (key) {
      available.push({
        name: provider.name,
        model: provider.model,
        baseUrl: provider.baseUrl,
        envVar: provider.env,
        source: process.env[provider.env] ? 'environment' : 'openclaw config',
      });
    }
  }
  return available;
}

/**
 * Load config from file, merging with defaults.
 */
const VALID_CONFIG_KEYS = new Set(Object.keys(DEFAULTS));
const VALID_API_KEY_ENVS = new Set(PROVIDERS.map(p => p.env));

export async function loadConfig() {
  let fileConfig = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = await readFile(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      // Only accept known config keys to prevent injection via tampered config files
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (VALID_CONFIG_KEYS.has(key)) fileConfig[key] = value;
        }
        // Validate apiKeyEnv against known provider env var names
        if (fileConfig.apiKeyEnv && !VALID_API_KEY_ENVS.has(fileConfig.apiKeyEnv)) {
          delete fileConfig.apiKeyEnv;
        }
      }
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
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  // Only persist non-default values. Never persist API keys.
  const toSave = {};
  for (const [key, value] of Object.entries(config)) {
    if (key === 'apiKey') continue; // never write keys to config
    if (value !== DEFAULTS[key] && value !== null) {
      toSave[key] = value;
    }
  }
  await writeFile(CONFIG_PATH, JSON.stringify(toSave, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  return CONFIG_PATH;
}

/**
 * Resolve effective config with auto-detected provider.
 * CLI flags > env vars > auto-detect > config file > defaults
 */
export async function resolveConfig(cliValues = {}) {
  const config = await loadConfig();

  // Auto-detect best provider if not explicitly configured
  const provider = await findBestProvider();
  if (provider) {
    if (!config.summaryModel) config.summaryModel = provider.model;
    if (!config.openaiBaseUrl) config.openaiBaseUrl = provider.baseUrl;
    if (!config.apiKeyEnv) config.apiKeyEnv = provider.envVar;
    // Stash the resolved key for runtime use (never persisted)
    config.apiKey = provider.apiKey;
  }

  // Env var overrides
  if (process.env.CLAWSIDIAN_VAULT) {
    config.vault = process.env.CLAWSIDIAN_VAULT;
  }

  // CLI overrides
  if (cliValues.vault) config.vault = cliValues.vault;
  if (cliValues['no-summary']) config.summarize = false;

  return config;
}

/**
 * Detect environment for init display.
 */
export async function detectEnvironment() {
  const detected = {
    obsidianInstalled: false,
    obsidianCli: false,
    vaultPath: null,
    openclawRunning: false,
    openclawConfig: existsSync(OPENCLAW_CONFIG),
    providers: [],
    bestProvider: null,
  };

  // Find available providers
  detected.providers = await listAvailableProviders();
  detected.bestProvider = detected.providers[0] || null;

  // Check for Obsidian app
  const obsidianConfigPath = join(homedir(), 'Library/Application Support/obsidian/obsidian.json');
  if (existsSync(obsidianConfigPath)) {
    detected.obsidianInstalled = true;
    try {
      const raw = await readFile(obsidianConfigPath, 'utf-8');
      const obsConfig = JSON.parse(raw);
      if (obsConfig.vaults) {
        const vaults = Object.values(obsConfig.vaults);
        const openVault = vaults.find(v => v.open);
        if (openVault?.path) {
          detected.vaultPath = openVault.path;
        } else if (vaults.length === 1 && vaults[0].path) {
          detected.vaultPath = vaults[0].path;
        }
      }
    } catch {}
  }

  // Check for obsidian-cli
  try {
    const { execSync } = await import('node:child_process');
    execSync('which obsidian-cli', { stdio: 'ignore' });
    detected.obsidianCli = true;
  } catch {}

  // Check for OpenClaw
  try {
    const { execSync } = await import('node:child_process');
    execSync('openclaw gateway status 2>/dev/null | grep -q "running"', { stdio: 'ignore' });
    detected.openclawRunning = true;
  } catch {}

  return detected;
}

export { CONFIG_PATH, CONFIG_DIR, DEFAULTS };
