import { getLatest10K, split10K, extractTextFrom10K, findPagesWithMostKeywordHits } from './services/edgarService';
import { createNotes } from './services/noteTaker';
import { logger } from './utils/logger';

async function main() {
  const cik = process.env.CIK || '0000789019';
  try {
    const res = await getLatest10K(cik);
    const split = await split10K(res);
    const pages = await extractTextFrom10K(split);
    
    // Find pages with most keyword hits for "Balance Sheet"
    // const balanceSheetPages = await findPagesWithMostKeywordHits(pages, "Balance Sheet", 3);
    // console.log("Balance Sheet Pages:", balanceSheetPages);

    // Create notes for the first 10 pages
    const firstTenPages = pages.slice(0, 10);
    const notes = await createNotes(firstTenPages);
    console.log("Company Notes (First 10 Pages):", JSON.stringify(notes, null, 2));

    // Optionally, you can create notes specifically for the balance sheet pages
    // const balanceSheetNotes = await createNotes(balanceSheetPages);
    // console.log("Balance Sheet Notes:", JSON.stringify(balanceSheetNotes, null, 2));

  } catch (error) {
    logger.error(`Error in main: ${error}`);
  }
}

main();