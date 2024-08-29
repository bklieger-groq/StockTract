import { getLatest10K, split10K, extractTextFrom10K } from './services/edgarService';
import { logger } from './utils/logger';

async function main() {
  const cik = process.env.CIK || '0000789019';
  try {
    const res = await getLatest10K(cik);
    const split = await split10K(res);
    const extract = await extractTextFrom10K(split);
    console.log(extract);
  } catch (error) {
    logger.error(`Error in main: ${error}`);
  }
}

main();