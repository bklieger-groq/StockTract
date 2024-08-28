import { getLatest10K } from './services/edgarService';
import { logger } from './utils/logger';

async function main() {
  const cik = process.env.CIK || '0000789019';
  try {
    const results = await getLatest10K(cik);
    console.log(results);
  } catch (error) {
    logger.error(`Error in main: ${error}`);
  }
}

main();