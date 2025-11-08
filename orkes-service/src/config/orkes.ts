/**
 * Orkes Conductor Client Configuration
 *
 * Manages connection and authentication to Orkes Cloud.
 * Uses environment variables for credentials.
 */

import 'dotenv/config';
import { orkesConductorClient } from '@io-orkes/conductor-javascript';
// The SDK's runtime client shape includes `workflowResource` and `metadataResource`.
// Keep types flexible to avoid compiler drift across SDK versions.
export type OrkesClient = any;
import dotenv from 'dotenv';

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
let client: OrkesClient | null = null;

export async function getOrkesClient(): Promise<OrkesClient> {
  if (client) {
    return client;
  }

  // Load .env.local if present (in addition to default .env)
  try {
    dotenv.config({ path: '.env.local' });
  } catch {
    // optional file; ignore errors
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
