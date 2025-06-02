import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TransportConfig } from '../config';

export async function createAndConnectClient(transportConfig: TransportConfig) {
  const transport = new StdioClientTransport({
    command: transportConfig.command,
    args: transportConfig.args
  });

  const client = new Client({
    name: 'cron-job-client',
    version: '1.0.0'
  });

  await client.connect(transport);
  
  return { client, transport };
} 