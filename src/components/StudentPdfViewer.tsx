import React, { useEffect, useState, useMemo } from 'react';
import { AlertCircle, FileText, Loader2, Award, CheckCircle } from 'lucide-react';
import { parseClassNumber, isMetadataOrNonScoreHeader } from '../utils';

interface StudentPdfViewerProps {
  pdfBase64: string;
  studentId: string;
  studentName: string;
  headers?: string[];
  row?: any;
  key?: string;
}

export interface ExtractedScore {
  areaName: string;
  score: string;
  maxScore: string;
}

interface MergedCell {
  text: string;
  x: number;
}

/**
 * Standardizes and formats the headers to remove decimals, percentage symbols,
 * and formats as "Title (MaxScore점)" as requested.
 */
export function cleanAndFormatHeaderName(rawHeader: string): string {
  let title = rawHeader.trim();
  title = title.replace(/\s+/g, ' ');

  // A precise check for "Total" / "Sum" to avoid false positives like "통계", "설계", "단계", "계획"
  const cleanSpace = title.replace(/\s+/g, '');
  const isTotal = [
    '합계', '총점', '총합', '원점수', '합계점수', '득점계'
  ].some(k => cleanSpace.includes(k)) || 
  cleanSpace === '계' || cleanSpace === '합' || cleanSpace === '총';

  // 1. Try to extract max score numeric value
  let maxScoreVal = '';
  const maxScoreRegexes = [
    /만점\s*([\d.]+)/,
    /배점\s*([\d.]+)/,
    /\(\s*([\d.]+)\s*점\s*\)/,
    /\[\s*([\d.]+)\s*점\s*\]/,
    /\(\s*([\d.]+)\s*점\s*만점\s*\)/,
    /\(([\d.]+)점\)/,
    /\(([\d.]+)점\s*만점\)/,
    /\(\s*([\d.]+)\s*\)/,
    /\[\s*([\d.]+)\s*\]/
  ];

  for (const regex of maxScoreRegexes) {
    const match = title.match(regex);
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed)) {
        maxScoreVal = parsed.toString(); // e.g. "30.00" -> "30"
        break;
      }
    }
  }

  if (isTotal) {
    if (maxScoreVal) {
      return `합계 (${maxScoreVal}점)`;
    }
    return '합계';
  }

  // 2. Clean the title from parentheticals completely
  let cleanTitle = title;
  
  // Clean custom format like (만점 30.00, 30.00%) or (30.00%, 만점 30.00) or (만점 30.00)
  cleanTitle = cleanTitle.replace(/\([^)]*만점[^)]*\)/gi, '');
  cleanTitle = cleanTitle.replace(/\[[^\]]*만점[^\]]*\]/gi, '');
  cleanTitle = cleanTitle.replace(/\([^)]*배점[^)]*\)/gi, '');
  cleanTitle = cleanTitle.replace(/\[[^\]]*배점[^\]]*\]/gi, '');
  cleanTitle = cleanTitle.replace(/\([^)]*%\s*\)/gi, '');
  cleanTitle = cleanTitle.replace(/\([^)]*[\d.]+\s*%[^)]*\)/gi, '');
  cleanTitle = cleanTitle.replace(/\([^)]*[\d.]+\s*점[^)]*\)/gi, '');
  cleanTitle = cleanTitle.replace(/\[[^\]]*[\d.]+\s*점[^\]]*\]/gi, '');
  cleanTitle = cleanTitle.replace(/\(\s*[\d.]+\s*\)/g, '');
  cleanTitle = cleanTitle.replace(/\[\s*[\d.]+\s*\]/g, '');

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  if (cleanTitle === '') {
    return '합계';
  }

  if (maxScoreVal) {
    return `${cleanTitle} (${maxScoreVal}점)`;
  }

  return cleanTitle;
}

/**
 * Merges text segments on the same line that are visually adjacent.
 * Prevents merging adjacent separate numbers/scores to protect column separation.
 */
function mergeRowCells(items: { text: string; x: number; y: number }[]): MergedCell[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const merged: MergedCell[] = [];

  let current = {
    text: sorted[0].text,
    xEnd: sorted[0].x + sorted[0].text.length * 6,
    count: 1,
    sumX: sorted[0].x
  };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const avgX = current.sumX / current.count;

    const currentClean = current.text.replace(/\s+/g, '');
    const itemClean = item.text.replace(/\s+/g, '');

    const isCurrentNum = /^\d+(\.\d+)?$/.test(currentClean);
    const isItemNum = /^\d+(\.\d+)?$/.test(itemClean);

    const hasSlashOrDash = currentClean.includes('/') || currentClean.includes('-') ||
                           itemClean.includes('/') || itemClean.includes('-');

    let limit = 40; // Default gap threshold for text/names

    if (hasSlashOrDash) {
      // Slashes or dashes are part of class/number, always merge them!
      limit = 35;
    } else if (isCurrentNum && isItemNum) {
      // Preserve separate score columns
      limit = 12;
    } else if (isCurrentNum || isItemNum) {
      // If one is numeric and another is text, keep them separate if they are columns, but some small gap is ok
      limit = 15;
    }

    if (item.x - current.xEnd < limit || item.x - avgX < limit) {
      current.text += ' ' + item.text;
      current.xEnd = Math.max(current.xEnd, item.x + item.text.length * 6);
      current.count += 1;
      current.sumX += item.x;
    } else {
      merged.push({
        text: current.text.trim(),
        x: current.sumX / current.count
      });
      current = {
        text: item.text,
        xEnd: item.x + item.text.length * 6,
        count: 1,
        sumX: item.x
      };
    }
  }

  merged.push({
    text: current.text.trim(),
    x: current.sumX / current.count
  });

  return merged;
}

export function formatPdfHeaderName(rawName: string) {
  const formatted = cleanAndFormatHeaderName(rawName);
  let title = formatted;
  let maxScoreText = '';
  
  const match = formatted.match(/^([\s\S]+?)\s*\(([\s\S]+?)\)$/);
  if (match) {
    title = match[1].trim();
    maxScoreText = match[2].trim(); // "20점"
  } else if (formatted === '합계') {
    title = '합계';
  }
  
  return { title, maxScoreText, rateText: '' };
}

/**
 * Checks if the parsed page belongs to the target class using statistical prefix match
 * and semantic classroom pattern matching.
 */
function isPageForClass(textLines: string[][], grade: string, classNum: string): boolean {
  const classPrefix = `${grade}${classNum.padStart(2, '0')}`; // e.g. "107"

  // Count how many cells on the page contain a 5-digit number starting with the classPrefix
  let prefixCount = 0;
  let slashPrefixCount = 0;
  
  textLines.forEach(line => {
    line.forEach(cell => {
      const cleaned = cell.replace(/\s+/g, '');
      if (cleaned.startsWith(classPrefix) && cleaned.length === 5 && /^\d+$/.test(cleaned)) {
        prefixCount++;
      }
      if (cleaned.startsWith(`${classNum}/`) || cleaned.startsWith(`${classNum}-`)) {
        slashPrefixCount++;
      }
    });
  });

  if (prefixCount >= 3) return true;
  if (slashPrefixCount >= 3) return true;

  // Check page text for classroom indications
  const pageAllText = textLines.flat().join(' ').replace(/\s+/g, '');
  const targetClassPadded = classNum.padStart(2, '0');
  if (
    pageAllText.includes(`${grade}학년${classNum}반`) ||
    pageAllText.includes(`${grade}학년${targetClassPadded}반`) ||
    pageAllText.includes(`${grade}-${classNum}`) ||
    pageAllText.includes(`${grade}-${targetClassPadded}`) ||
    pageAllText.includes(`반:${classNum}`) ||
    pageAllText.includes(`반:${targetClassPadded}`) ||
    pageAllText.includes(`반${classNum}`) ||
    pageAllText.includes(`반${targetClassPadded}`)
  ) {
    return true;
  }

  // Regex check for custom school designations like "1학년 콘텐츠디자인과 7"
  try {
    const rx = new RegExp(`${grade}\\s*학년.*${classNum}`);
    if (rx.test(textLines.flat().join(' '))) {
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Finds the index of the student's row within a page using highly robust matching criteria.
 */
function findStudentRowInPage(
  textLines: string[][],
  rawLines: any[][],
  cleanStudentName: string,
  studentId: string,
  targetClass: string,
  targetNumber: string,
  targetNumberWithZero: string
): number {
  const targetGrade = studentId.length >= 5 ? studentId[0] : '1';

  for (let r = 0; r < textLines.length; r++) {
    const rawLineCells = rawLines[r];
    if (!rawLineCells || rawLineCells.length < 2) continue;

    const cleanMergedCells = mergeRowCells(rawLineCells);
    if (cleanMergedCells.length < 2) continue;

    const combinedText = textLines[r].join('').replace(/\s+/g, '');

    // 1. Ultimate Fail-safe Priority: Exact 5-digit Student ID (e.g., 10701) present anywhere in this row's combined text
    if (combinedText.includes(studentId)) {
      return r;
    }

    // 2. Class/Number combo matching inside structural columns (e.g. "1-7-1", "7-1", "1/7/1", "7/1", "10701", "07-01", "7반1번")
    let matchedByStructuredColumns = false;
    const maxScanCols = Math.min(5, cleanMergedCells.length);

    for (let c = 0; c < maxScanCols; c++) {
      const cellText = cleanMergedCells[c].text.replace(/\s+/g, '');
      if (!cellText) continue;

      const cellCleaned = cellText.replace(/[가-힣]/g, ''); // strip letters like 학년, 반, 번

      // 5-digit academic ID direct match (e.g. "10701")
      if (cellCleaned === studentId && /^\d{5}$/.test(cellCleaned)) {
        matchedByStructuredColumns = true;
        break;
      }

      // Three part split like "1-7-1" or "1/7/1" or "1.7.1"
      if (/^\d+[-\/.]\d+[-\/.]\d+$/.test(cellCleaned)) {
        const parts = cellCleaned.split(/[-\/.]/);
        if (
          parseInt(parts[0], 10) === parseInt(targetGrade, 10) &&
          parseInt(parts[1], 10) === parseInt(targetClass, 10) &&
          parseInt(parts[2], 10) === parseInt(targetNumber, 10)
        ) {
          matchedByStructuredColumns = true;
          break;
        }
      }

      // Two part split like "7-1" or "7/1" or "7.1" or "07-01"
      if (/^\d+[-\/.]\d+$/.test(cellCleaned)) {
        const parts = cellCleaned.split(/[-\/.]/);
        if (
          parseInt(parts[0], 10) === parseInt(targetClass, 10) &&
          parseInt(parts[1], 10) === parseInt(targetNumber, 10)
        ) {
          matchedByStructuredColumns = true;
          break;
        }
      }

      // Semantic Korean text (e.g. "7반1번" or "1학년7반1번")
      if (cellText.includes('반') && cellText.includes('번')) {
        const matchGrad = cellText.match(/(\d+)\s*학년/);
        const matchCls = cellText.match(/(\d+)\s*반/);
        const matchNum = cellText.match(/(\d+)\s*번/);

        const gradeOk = !matchGrad || parseInt(matchGrad[1], 10) === parseInt(targetGrade, 10);
        const classOk = matchCls && parseInt(matchCls[1], 10) === parseInt(targetClass, 10);
        const numberOk = matchNum && parseInt(matchNum[1], 10) === parseInt(targetNumber, 10);

        if (gradeOk && classOk && numberOk) {
          matchedByStructuredColumns = true;
          break;
        }
      }
    }

    if (matchedByStructuredColumns) {
      return r;
    }

    // 3. Sequential Separate Columns matching (e.g. [Class, Number] or [Serial/Grade, Class, Number])
    const parsedCells: number[] = [];
    for (let c = 0; c < Math.min(4, cleanMergedCells.length); c++) {
      const txt = cleanMergedCells[c].text.replace(/\s+/g, '');
      const val = parseInt(txt, 10);
      if (!isNaN(val) && /^\d+$/.test(txt)) {
        parsedCells.push(val);
      }
    }

    if (parsedCells.length >= 2) {
      // Look for [Class, Number] (e.g. [7, 1])
      if (parsedCells[0] === parseInt(targetClass, 10) && parsedCells[1] === parseInt(targetNumber, 10)) {
        return r;
      }
    }

    if (parsedCells.length >= 3) {
      // Look for [Grade/Serial, Class, Number] (e.g. [1, 7, 1] or [12, 7, 1])
      if (parsedCells[1] === parseInt(targetClass, 10) && parsedCells[2] === parseInt(targetNumber, 10)) {
        return r;
      }
    }

    // 4. Fallback: Check if the digits-only version of any early cell matches the student ID or targetNumber
    for (let c = 0; c < Math.min(4, cleanMergedCells.length); c++) {
      const txtDigits = cleanMergedCells[c].text.replace(/\D/g, '');
      if (txtDigits === studentId) {
        return r;
      }
    }

    // 5. Fallback 2: Exact containment of targetClass and targetNumber as distinct words/numbers in the text line
    const containsNumber = combinedText.includes(targetNumber) || combinedText.includes(targetNumberWithZero);
    const containsClass = combinedText.includes(targetClass) || combinedText.includes('0' + targetClass);

    if (containsNumber && containsClass && textLines.length <= 45) {
      // On narrow page outputs with fewer than 45 rows (one typical class page size limit),
      // containment of correct numbers is strong indicator
      return r;
    }
  }

  // 6. Word-boundary absolute fallback check for dense line layouts
  for (let r = 0; r < textLines.length; r++) {
    const lineStr = textLines[r].join(' ');
    const numTokens = lineStr.split(/[^0-9]/).filter(t => t !== '');
    if (numTokens.includes(studentId)) {
      return r;
    }
  }

  return -1;
}

export default function StudentPdfViewer({ 
  pdfBase64, 
  studentId, 
  studentName,
  headers,
  row
}: StudentPdfViewerProps) {
  // Compute score details synchronously if valid headers and row are supplied as props
  const parsedDataFromProps = useMemo(() => {
    if (headers && headers.length > 0 && row && Object.keys(row).length > 0) {
      const areaScores: ExtractedScore[] = [];
      let totalScore = '';
      let totalMaxScore = '';

      headers.forEach(h => {
        if (isMetadataOrNonScoreHeader(h)) return;
        const hCleaned = cleanAndFormatHeaderName(h);

        const isTotal = hCleaned.startsWith('합계');
        
        let scoreVal = String(row[h] !== undefined ? row[h] : '0').trim();
        if (/^\d+\.00$/.test(scoreVal)) {
          scoreVal = parseFloat(scoreVal).toString();
        } else if (/^\d+\.\d+$/.test(scoreVal)) {
          const parsedFloat = parseFloat(scoreVal);
          if (!isNaN(parsedFloat)) {
            scoreVal = parsedFloat.toString();
          }
        }

        // Extract max score from header
        let maxScoreVal = '100';
        const hMatch = hCleaned.match(/\((\d+)점\)/) || hCleaned.match(/\(([\d.]+)점\)/);
        if (hMatch && hMatch[1]) {
          maxScoreVal = hMatch[1];
        } else {
          const maxMatch = h.match(/만점\s*([\d.]+)/) || h.match(/배점\s*([\d.]+)/) || h.match(/만점\s*(\d+)/);
          if (maxMatch && maxMatch[1]) {
            maxScoreVal = parseFloat(maxMatch[1]).toString();
          } else {
            const numMatch = h.match(/\(\s*([\d.]+)\s*\)?/) || h.match(/\[\s*([\d.]+)\s*\]?/);
            if (numMatch && numMatch[1]) {
              maxScoreVal = parseFloat(numMatch[1]).toString();
            }
          }
        }

        if (isTotal) {
          totalScore = scoreVal;
          totalMaxScore = maxScoreVal;
        } else {
          areaScores.push({
            areaName: hCleaned,
            score: scoreVal,
            maxScore: maxScoreVal
          });
        }
      });

      if ((!totalMaxScore || totalMaxScore === '100' || totalMaxScore === '0') && areaScores.length > 0) {
        const maxSum = areaScores.reduce((acc, curr) => acc + (parseFloat(curr.maxScore) || 0), 0);
        if (maxSum > 0) {
          totalMaxScore = String(maxSum);
        }
      }

      if (!totalScore && areaScores.length > 0) {
        const sum = areaScores.reduce((acc, curr) => acc + (parseFloat(curr.score) || 0), 0);
        totalScore = String(sum);
      }

      return {
        areaScores,
        totalScore,
        totalMaxScore,
        matchedPage: 1,
        totalPages: 1
      };
    }
    return null;
  }, [JSON.stringify(headers), JSON.stringify(row)]);

  const [loading, setLoading] = useState(!parsedDataFromProps);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    areaScores: ExtractedScore[];
    totalScore: string;
    totalMaxScore: string;
    matchedPage: number;
    totalPages: number;
  } | null>(null);

  const activeData = parsedDataFromProps || extractedData;
  const activeLoading = parsedDataFromProps ? false : loading;
  const activeError = parsedDataFromProps ? null : error;

  useEffect(() => {
    if (parsedDataFromProps) {
      setLoading(false);
      setError(null);
      setExtractedData(null);
      return;
    }

    let active = true;

    async function parseAndExtractPdf() {
      setLoading(true);
      setError(null);
      setExtractedData(null);

      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        setError('PDF 분석 엔진(pdfjs)을 로드하지 못했습니다. 페이지 새로고침 후 다시 시도해 주세요.');
        setLoading(false);
        return;
      }

      try {
        // 1. Base64 디코딩하여 Uint8Array로 변환
        let base64String = pdfBase64;
        if (base64String.startsWith('data:')) {
          const index = base64String.indexOf('base64,');
          if (index !== -1) {
            base64String = base64String.substring(index + 7);
          }
        }

        const binStr = atob(base64String);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        let matchedPageNum = -1;
        let finalAreaScores: ExtractedScore[] = [];
        let finalTotalScore = '';
        let finalTotalMaxScore = '';

        const cleanStudentName = studentName.replace(/\s+/g, '');
        const rawClass = studentId.length >= 5 ? studentId.substring(1, 3) : '';
        const targetClass = rawClass ? parseInt(rawClass, 10).toString() : ''; // "07" -> "7", "11" -> "11"
        const targetNumber = studentId.length >= 5 ? parseInt(studentId.substring(3), 10).toString() : ''; // "12" -> "12", "05" -> "5"
        const targetNumberWithZero = studentId.length >= 5 ? studentId.substring(3).padStart(2, '0') : ''; // "05" -> "05"

        interface PageData {
          pageNum: number;
          textLines: string[][];
          rawLines: any[][];
        }
        const pagesData: PageData[] = [];

        // 2. Load and parse all pages in memory first
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];

          if (items.length === 0) continue;

          // Y-coordinate grouping tolerance
          const tolerance = 6;
          const linesMap: { [y: number]: any[] } = {};

          items.forEach(item => {
            const str = item.str || '';
            if (str.trim() === '') return;

            const x = item.transform[4] || 0;
            const y = item.transform[5] || 0;

            const foundY = Object.keys(linesMap).map(Number).find(keyY => Math.abs(keyY - y) <= tolerance);
            const itemObj = { text: str, x, y };

            if (foundY !== undefined) {
              linesMap[foundY].push(itemObj);
            } else {
              linesMap[y] = [itemObj];
            }
          });

          const sortedYKeys = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
          const textLines: string[][] = [];
          const rawLines: any[][] = [];

          sortedYKeys.forEach(y => {
            const lineItems = linesMap[y];
            lineItems.sort((a: any, b: any) => a.x - b.x);
            textLines.push(lineItems.map((item: any) => item.text));
            rawLines.push(lineItems);
          });

          pagesData.push({ pageNum, textLines, rawLines });
        }

        let matchedPageData: PageData | null = null;
        let studentRowIdx = -1;

        const parsedGrade = studentId.length >= 5 ? studentId[0] : '1';

        // PASS 1: Search pages with Class restriction enabled (avoids false-positive names in other classes)
        for (const pData of pagesData) {
          const isClassMatchPage = totalPages === 1 || isPageForClass(pData.textLines, parsedGrade, targetClass);
          if (!isClassMatchPage) continue;

          const foundRowIdx = findStudentRowInPage(
            pData.textLines,
            pData.rawLines,
            cleanStudentName,
            studentId,
            targetClass,
            targetNumber,
            targetNumberWithZero
          );
          if (foundRowIdx !== -1) {
            matchedPageData = pData;
            studentRowIdx = foundRowIdx;
            break;
          }
        }

        // PASS 2: Search pages without Class restriction fallback (if page headers or matching failed on Pass 1)
        if (studentRowIdx === -1) {
          for (const pData of pagesData) {
            const foundRowIdx = findStudentRowInPage(
              pData.textLines,
              pData.rawLines,
              cleanStudentName,
              studentId,
              targetClass,
              targetNumber,
              targetNumberWithZero
            );
            if (foundRowIdx !== -1) {
              matchedPageData = pData;
              studentRowIdx = foundRowIdx;
              break;
            }
          }
        }

        // 3. Process matched student data
        if (matchedPageData && studentRowIdx !== -1) {
          const { pageNum, textLines, rawLines } = matchedPageData;
          matchedPageNum = pageNum;

          const studentCellsObj = rawLines[studentRowIdx];
          const cleanMergedCells = mergeRowCells(studentCellsObj);

          // Resolve Name column index robustly
          let nameColIdx = -1;
          for (let c = 0; c < Math.min(4, cleanMergedCells.length); c++) {
            const txt = cleanMergedCells[c].text.replace(/\s+/g, '');
            if (txt !== '' && !['반', '번호', '반/번호', '학번', '학년', '성별', '연번'].some(k => txt.includes(k))) {
              const isNumericOrID = /^[0-9./\s-]+$/.test(txt);
              if (!isNumericOrID) {
                nameColIdx = c;
                break;
              }
            }
          }

          if (nameColIdx === -1) {
            nameColIdx = 0; // Fallback to 0 if no Name column exists, starting scores from index 1.
          }

          // Find the Header row index on this page to identify the boundaries of header elements
          let headerRowIdx = -1;
          for (let r = 0; r < textLines.length; r++) {
            const line = textLines[r];
            const hasNumberOrClassNo = line.some(cell => {
              const c = cell.replace(/\s+/g, '');
              return c === '번호' || c === 'NO' || c === 'No' || c === 'No.' || 
                     c.includes('반/번호') || c.includes('반·번호') || c.includes('반,번호') || c.includes('반번호') ||
                     c.includes('학성') || c.includes('학적') || c.includes('학번');
            });
            const hasClassOrName = line.some(cell => {
              const c = cell.replace(/\s+/g, '');
              return c === '성명' || c === '이름' || c === '반' || c === '학급' || c === '반(학급)' || c.includes('학생명') || c.includes('이 름');
            });

            if (hasNumberOrClassNo && hasClassOrName) {
              headerRowIdx = r;
              break;
            }
          }

          if (headerRowIdx === -1) headerRowIdx = 0;

          // Locate firstStudentRowIdx for the page to avoid previous students polluting the header
          let firstStudentRowIdx = -1;
          for (let r = headerRowIdx + 1; r < textLines.length; r++) {
            const rawLineCells = rawLines[r];
            if (!rawLineCells || rawLineCells.length < 2) continue;

            const cleanMergedCellsForFirst = mergeRowCells(rawLineCells);
            if (cleanMergedCellsForFirst.length < 2) continue;

            let nameColMatchIdx = -1;
            for (let c = 0; c < Math.min(4, cleanMergedCellsForFirst.length); c++) {
              const txt = cleanMergedCellsForFirst[c].text.replace(/\s+/g, '');
              if (txt !== '' && !['반', '번호', '반/번호', '학번', '학년', '성별', '연번'].some(k => txt.includes(k))) {
                const isPureNum = /^\d+$/.test(txt) || /^\d+\/\d+$/.test(txt);
                if (!isPureNum) {
                  nameColMatchIdx = c;
                  break;
                }
              }
            }

            if (nameColMatchIdx !== -1) {
              const studentNameVal = cleanMergedCellsForFirst[nameColMatchIdx].text.trim();
              const normName = studentNameVal.replace(/\s+/g, '');
              if (normName !== '' && !['합계', '총점', '총합', '계', '원점수', '평균', '응시', '전체', '만점', '배점', '소계', '평가', '명판', '의사', '학교', '학급', '교사', '평가영역', '성적'].some(k => normName.includes(k))) {
                firstStudentRowIdx = r;
                break;
              }
            }
          }

          if (firstStudentRowIdx === -1) {
            firstStudentRowIdx = headerRowIdx + 1;
          }

          // Projections for column headers
          const columnHeaders: string[] = Array(cleanMergedCells.length).fill('');
          const headerItemsAbove: any[] = [];

          // Gather all header text items from lines purely above the first student row on this page
          for (let rowIdx = 0; rowIdx < firstStudentRowIdx; rowIdx++) {
            rawLines[rowIdx].forEach(item => {
              headerItemsAbove.push(item);
            });
          }

          // Sort: Top to Bottom, Left to Right
          headerItemsAbove.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 6) {
              return b.y - a.y;
            }
            return a.x - b.x;
          });

          // Associate header text items to the closest student row columns by horizontal coordinate distance
          headerItemsAbove.forEach(item => {
            let closestColIdx = -1;
            let minDistance = Infinity;

            for (let c = 0; c < cleanMergedCells.length; c++) {
              const dist = Math.abs(item.x - cleanMergedCells[c].x);
              if (dist < minDistance) {
                minDistance = dist;
                closestColIdx = c;
              }
            }

            if (closestColIdx !== -1) {
              if (columnHeaders[closestColIdx]) {
                columnHeaders[closestColIdx] += ' ' + item.text;
              } else {
                columnHeaders[closestColIdx] = item.text;
              }
            }
          });

          const tempScores: ExtractedScore[] = [];

          for (let col = nameColIdx + 1; col < cleanMergedCells.length; col++) {
            const rawHeader = columnHeaders[col] || '';
            if (isMetadataOrNonScoreHeader(rawHeader)) {
              continue;
            }
            const formattedHeader = cleanAndFormatHeaderName(rawHeader);

            if (formattedHeader === '') {
              continue;
            }

            const scoreVal = cleanMergedCells[col].text.trim();
            const isTotal = formattedHeader === '합계';

            let maxVal = '100';
            const maxMatch = rawHeader.match(/만점\s*([\d.]+)/) || rawHeader.match(/배점\s*([\d.]+)/) || rawHeader.match(/만점\s*(\d+)/);
            if (maxMatch && maxMatch[1]) {
              maxVal = parseFloat(maxMatch[1]).toString();
            } else {
              const numMatch = rawHeader.match(/\(\s*([\d.]+)\s*\)?/) || rawHeader.match(/\[\s*([\d.]+)\s*\]?/);
              if (numMatch && numMatch[1]) {
                maxVal = parseFloat(numMatch[1]).toString();
              }
            }

            if (isTotal) {
              finalTotalScore = scoreVal;
              finalTotalMaxScore = maxVal;
            } else {
              tempScores.push({
                areaName: formattedHeader,
                score: scoreVal,
                maxScore: maxVal
              });
            }
          }

          if (!finalTotalScore && tempScores.length > 0) {
            const sum = tempScores.reduce((acc, curr) => acc + (parseFloat(curr.score) || 0), 0);
            const maxSum = tempScores.reduce((acc, curr) => acc + (parseFloat(curr.maxScore) || 0), 0);
            finalTotalScore = String(sum);
            finalTotalMaxScore = String(maxSum);
          }

          finalAreaScores = tempScores;
        }

        if (!active) return;

        if (matchedPageNum !== -1 && finalAreaScores.length > 0) {
          setExtractedData({
            areaScores: finalAreaScores,
            totalScore: finalTotalScore,
            totalMaxScore: finalTotalMaxScore,
            matchedPage: matchedPageNum,
            totalPages
          });
        } else {
          setError(`나이스 종합 PDF 일람표 내부에서 학번 [${studentId}]에 해당하는 개별 성적 데이터를 자동으로 추출하지 못했습니다.\n\n[알아두기] 교과 담당 선생님께 이 과목 PDF 자료에 학생 본인의 학번(${studentId}) 번호가 정확히 등록되어 성적 조회가 가능한 정상 텍스트형 한글/엑셀 변환 일람표인지 체크를 요청해주세요.`);
        }

      } catch (err: any) {
        console.error('PDF parsing/extraction error:', err);
        if (active) {
          setError(`PDf 데이터 추출 도중 분석 오류가 발생했습니다: ${err.message || err}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    parseAndExtractPdf();

    return () => {
      active = false;
    };
  }, [pdfBase64, studentId, studentName, JSON.stringify(headers), JSON.stringify(row)]);

  const handleDownloadPdf = () => {
    if (!pdfBase64) return;
    try {
      let cleanBase64 = pdfBase64;
      if (pdfBase64.includes(',')) {
        cleanBase64 = pdfBase64.split(',')[1];
      }
      
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `[성적통지표]_${studentId}_${studentName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('PDF 다운로드 실패:', err);
      alert('PDF 파일 다운로드 도중 오류가 발생했습니다: ' + (err.message || err));
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden p-5 space-y-5 shadow-xxs">
      
      {/* 1. Header Information Alert */}
      <div className="flex border-b border-rose-100 pb-3 flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-rose-950 font-black">
          <FileText size={16} className="text-rose-600" />
          <span className="text-xs">
            {pdfBase64 ? '나이스 출력 수행평가 점수 (PDF 자동 분석)' : '나이스 확인용 수행평가 점수'}
          </span>
        </div>
        
        {activeData && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-800 px-2.5 py-1 rounded-md font-bold">
              🔒 개인 안심 조회
            </span>            
          </div>
        )}
      </div>

      {/* 2. Loading State */}
      {activeLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 select-none text-slate-400">
          <Loader2 className="animate-spin text-rose-600" size={32} />
          <div className="text-center space-y-1">
            <span className="text-xs font-black text-slate-700 block">선생님이 등록한 나이스 확정 일람표 EXCEL 자료를 정밀 분석 중...</span>
            <span className="text-[10px] text-slate-400 block font-medium">개인 프라이버시 조율을 위해 본인 성적 이외의 전체 EXCEL 화면 및 타인 정보 노출은 전면 차단됩니다.</span>
          </div>
        </div>
      )}

      {/* 3. Error Case */}
      {activeError && !activeLoading && (
        <div className="p-4 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2.5 text-xs text-rose-850 font-semibold leading-relaxed">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-1">
            <p className="font-extrabold whitespace-pre-wrap">{activeError}</p>
            <p className="text-[10px] text-slate-500 font-medium leading-normal pt-1 bg-white/20 border-t border-rose-100/30">
              💡 만약 일람표 EXCEL 파일이 이미지(스캔본) 형태로 글자 식별이 불가능하다면 텍스트 기반 일람표를 다시 등록해주시거나, Excel 파일로 최종 성적을 재등록해주시길 교과 선생님께 부탁해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 4. Extracted Results UI Cards (PDF 노출 없는 완벽한 개인 카드화) */}
      {activeData && !activeLoading && (
        <div className="space-y-5">
          {/* Top Privacy Notice Strip */}
          <div className="bg-emerald-50/50 border border-emerald-150 p-3.5 rounded-xl text-xs text-emerald-950 font-semibold flex items-center gap-2.5 leading-relaxed">
            <CheckCircle size={15} className="text-emerald-650 shrink-0" />
            <span>학번 <strong>{studentId} {studentName}</strong> 학생의 나이스에 입력된 수행평가 점수입니다.</span>
          </div>

          {/* Cards Grid: Each '네모 한칸' is styled as a clean card resembling spreadsheet table cells */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr gap-4">
            {activeData.areaScores.map((item, idx) => {
              const { title, maxScoreText } = formatPdfHeaderName(item.areaName);

              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-250 p-4.5 rounded-xl flex flex-col justify-between shadow-3xs transition-all hover:border-slate-350"
                >
                  <div className="text-center space-y-1 pb-3 border-b border-slate-100">
                    {/* Column Header Representation */}
                    <h4 className="text-xs font-bold text-slate-800 leading-snug break-keep">
                      {title}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-semibold block">
                      ({maxScoreText || `${item.maxScore}점`})
                    </span>
                  </div>

                  {/* Column Score Representation */}
                  <div className="pt-3 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-900 font-sans tracking-tight">
                      {item.score}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Combined Total (합계) renders as the prominent last card in the grid with a sleek neutral grey tint */}
            <div className="bg-slate-50 border border-slate-300 p-4.5 rounded-xl flex flex-col justify-between shadow-3xs transition-all hover:border-slate-400">
              <div className="text-center space-y-1 pb-3 border-b border-slate-200">
                <h4 className="text-xs font-black text-slate-900 leading-snug break-keep">
                  합 계
                </h4>
                <span className="text-[11px] text-slate-500 font-extrabold block">
                  ({activeData.totalMaxScore}점 만점)
                </span>
              </div>

              <div className="pt-3 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-950 font-sans tracking-tight">
                  {activeData.totalScore}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
