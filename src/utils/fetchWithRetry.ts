import axios from 'axios';
import { logger } from './logger';

export async function fetchWithRetry(url: string, options: any, retries = 3): Promise<any> {
  url = url.replace(/ix\?doc=/, ''); // Remove interactive mode
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error: any) {
    if (retries > 0 && error.response?.status === 429) {
      logger.warn(`Rate limit hit, retrying in 1 second. Retries left: ${retries - 1}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}