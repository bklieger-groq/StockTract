import { EDGAR_API_BASE_URL, USER_AGENT } from '../config/constants';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { logger } from '../utils/logger';

async function getLatest10KURL(cik: string): Promise<string> {
  const submissionsUrl = `${EDGAR_API_BASE_URL}${cik}.json`;
  const data = await fetchWithRetry(submissionsUrl, { headers: { 'User-Agent': USER_AGENT } });

  const recentFilings = data.filings.recent;
  const tenKIndex = recentFilings.form.findIndex((form: string) => form === '10-K');

  if (tenKIndex === -1) {
    throw new Error('No 10-K filing found in recent submissions');
  }

  const accessionNumber = recentFilings.accessionNumber[tenKIndex].replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber}/${recentFilings.accessionNumber[tenKIndex]}-index.htm`;
}

export async function getLatest10K(cik: string): Promise<string> {
  try {
    const latest10KURL = await getLatest10KURL(cik);
    const indexPage = await fetchWithRetry(latest10KURL, { headers: { 'User-Agent': USER_AGENT } });
    const mainDocumentMatch = indexPage.match(/href="([^"]*\/\w+-\d+\.htm)"/i);

    if (!mainDocumentMatch) {
      throw new Error('Main 10-K document link not found in the index page');
    }

    const mainDocumentUrl = new URL(mainDocumentMatch[1], 'https://www.sec.gov').toString();
    const documentContent = await fetchWithRetry(mainDocumentUrl, {
      responseType: 'text',
      headers: { 'User-Agent': USER_AGENT }
    });

    return documentContent;
  } catch (error: any) {
    logger.error(`Error in getLatest10K: ${error.message}`);
    throw error;
  }
}