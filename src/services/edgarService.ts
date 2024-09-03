import { EDGAR_API_BASE_URL, USER_AGENT } from '../config/constants';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { logger } from '../utils/logger';
import { JSDOM } from 'jsdom';

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

export async function split10K(content: string): Promise<string[]> {
  try {
    const sections = content.split('<hr style="page-break-after:always;"/>');
    return sections.map(section => section.trim()).filter(section => section.length > 0);
  } catch (error: any) {
    logger.error(`Error in getLatest10KSections: ${error.message}`);
    throw error;
  }
}

export function extractTextFrom10K(sections: string[]): string[] {
    return sections.map(section => {
      const dom = new JSDOM(section);
      const doc = dom.window.document;
      
      // Extract text from all elements, removing extra whitespace
      const textNodes = doc.evaluate(
        '//text()', 
        doc, 
        null, 
        dom.window.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, 
        null
      );
  
      let pageText = '';
      for (let i = 0; i < textNodes.snapshotLength; i++) {
        const node = textNodes.snapshotItem(i);
        if (node) {
          const text = node.textContent?.trim();
          if (text) {
            pageText += text + ' ';
          }
        }
      }
  
      // Remove extra spaces and trim
      return pageText.replace(/\s+/g, ' ').trim();
    }).filter(text => text.length > 0); // Remove empty pages
  }

  export function findPagesWithMostKeywordHits(pages: string[], keyword: string, numPages: number): string[] {
    const pageHits: { page: string; hits: number }[] = pages.map(page => {
      const regex = new RegExp(keyword, 'gi');
      const hits = (page.match(regex) || []).length;
      return { page, hits };
    });
  
    // Sort pages by number of hits in descending order
    pageHits.sort((a, b) => b.hits - a.hits);
  
    // Return the top numPages pages
    return pageHits.slice(0, numPages).map(ph => ph.page);
  }