/**
 * Orkes Conductor Client Configuration
 *
 * Manages connection and authentication to Orkes Cloud.
 * Uses environment variables for credentials.
 */

import { orkesConductorClient } from '@io-orkes/conductor-javascript';
import type { ConductorClient } from '@io-orkes/conductor-javascript';

export interface OrkesConfig {
  serverUrl: string;
  keyId?: string;
  keySecret?: string;
  refreshTokenInterval?: number;
}

/**
 * Get Orkes configuration from environment variables
 */
export function getOrkesConfig(): OrkesConfig {
  const config: OrkesConfig = {
    serverUrl: process.env.ORKES_SERVER_URL || 'https://developer.orkescloud.com/api',
  };

  // Add authentication if credentials are provided
  if (process.env.ORKES_KEY_ID && process.env.ORKES_KEY_SECRET) {
    config.keyId = process.env.ORKES_KEY_ID;
    config.keySecret = process.env.ORKES_KEY_SECRET;
    config.refreshTokenInterval = 600000; // 10 minutes
  }

  return config;
}

/**
 * Initialize Orkes Conductor client
 */
let client: ConductorClient | null = null;

export async function getOrkesClient(): Promise<ConductorClient> {
  if (client) {
    return client;
  }

  const config = getOrkesConfig();

  console.log('[Orkes] Connecting to:', config.serverUrl);
  console.log('[Orkes] Authentication:', config.keyId ? 'Enabled' : 'Disabled (Public)');

  try {
    client = await orkesConductorClient(config);
    console.log('[Orkes] Client initialized successfully');
    return client;
  } catch (error) {
    console.error('[Orkes] Failed to initialize client:', error);
    throw error;
  }
}

/**
 * Close Orkes client connection (cleanup)
 */
export function closeOrkesClient(): void {
  if (client) {
    console.log('[Orkes] Closing client connection');
    client = null;
  }
}
