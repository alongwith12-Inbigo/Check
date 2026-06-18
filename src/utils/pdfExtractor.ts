import { findStudentIdKey, findNameKey, parseClassNumber } from '../utils';

interface ExtractedScore {
  areaName: string;
  score: string;
  maxScore: string;
}

export interface ExtractedPdfData {
  headers: string[];
  rows: any[];
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

  // Remove percentage parts (e.g. ", 30.00%")
  title = title.replace(/,\s*[\d.]+\s*%/g, '');
  title = title.replace(/[\d.]+\s*%\s*,?/g, '');

  let maxScoreVal = '';
  // Try to find any numeric max score like (만점 30.00) or [만점 20] or (20점) or (20.0)
  const maxScoreRegexes = [
    /만점\s*([\d.]+)/,
    /배점\s*([\d.]+)/,
    /\(\s*([\d.]+)\s*점\s*\)/,
    /\(\s*만점\s*([\d.]+)\s*점\s*\)/,
    /\[\s*만점\s*([\d.]+)\s*\]/,
    /\(\s*([\d.]+)\s*\)/,
    /\[\s*([\d.]+)\s*\]/
  ];

  for (const regex of maxScoreRegexes) {
    const match = title.match(regex);
    if (match && match[1]) {
      maxScoreVal = parseFloat(match[1]).toString(); // "30.00" -> "30"
      break;
    }
  }

  // Check if it represents Total Score column
  const isTotal = ['합계', '합 계', '총점', '총합', '계', '원점수', '합'].some(k => title.replace(/\s+/g, '').includes(k));
  if (isTotal) {
    return '합계';
  }

  // Clean title: remove any parentheses or brackets containing the score/max word
  let cleanTitle = title;
  cleanTitle = cleanTitle.replace(/\(\s*만점\s*[\d.]+\s*%\s*\)/g, '');
  cleanTitle = cleanTitle.replace(/\(\s*만점\s*[\d.]+\s*\)/g, '');
  cleanTitle = cleanTitle.replace(/\[\s*만점\s*[\d.]+\s*\]/g, '');
  cleanTitle = cleanTitle.replace(/\(\s*[\d.]+\s*점\s*\)/g, '');
  cleanTitle = cleanTitle.replace(/\(\s*[\d.]+\s*\)/g, '');
  cleanTitle = cleanTitle.replace(/\[\s*[\d.]+\s*\]/g, '');
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  // If cleanTitle is blank, default to '합계'
  if (cleanTitle === '') {
    return '합계';
  }

  // Format as "Title (MaxScore점)"
  if (maxScoreVal) {
    return `${cleanTitle} (${maxScoreVal}점)`;
  }

  return cleanTitle;
}

/**
 * Merges text segments on the same line that are visually adjacent (X-coordinate gap < 45).
 * Extremely robust for joining name fragments and split numbers.
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
    if (item.x - current.xEnd < 45 || item.x - avgX < 45) {
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

/**
 * Extracts student scores from a PDF Base64 string.
 */
export async function extractDataFromPdf(
  pdfBase64: string,
  targetGradeClass: string
): Promise<ExtractedPdfData | null> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    console.error('PDF.js not loaded on window.');
    return null;
  }

  try {
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

    const allHeadersSet = new Set<string>();
    const allParsedRows: any[] = [];
    const seenStudentIds = new Set<string>();

    const parsedGrade = targetGradeClass && targetGradeClass.trim().length > 0
      ? targetGradeClass.trim()[0]
      : '1';

    const parsedClass = targetGradeClass && targetGradeClass.trim().length >= 3
      ? parseInt(targetGradeClass.trim().substring(1), 10).toString()
      : '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      if (items.length === 0) continue;

      // Group by Y-coordinate
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

      // Find the Header row index
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

      if (headerRowIdx === -1) continue;

      // 2. Locate the first student row below the header index
      let firstStudentRowIdx = -1;
      for (let r = headerRowIdx + 1; r < textLines.length; r++) {
        const rawLineCells = rawLines[r];
        if (!rawLineCells || rawLineCells.length < 2) continue;

        const cleanMergedCells = mergeRowCells(rawLineCells);
        if (cleanMergedCells.length < 2) continue;

        let nameColIdx = -1;
        for (let c = 0; c < Math.min(4, cleanMergedCells.length); c++) {
          const txt = cleanMergedCells[c].text.replace(/\s+/g, '');
          if (txt !== '' && !['반', '번호', '반/번호', '학번', '학년', '성별', '연번'].some(k => txt.includes(k))) {
            const isPureNum = /^\d+$/.test(txt) || /^\d+\/\d+$/.test(txt);
            if (!isPureNum) {
              nameColIdx = c;
              break;
            }
          }
        }

        if (nameColIdx !== -1) {
          const studentNameVal = cleanMergedCells[nameColIdx].text.trim();
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

      // 3. Precompute all header items belonging to lines purely ABOVE firstStudentRowIdx
      const headerItemsAbove: any[] = [];
      for (let rowIdx = 0; rowIdx < firstStudentRowIdx; rowIdx++) {
        rawLines[rowIdx].forEach(item => {
          headerItemsAbove.push(item);
        });
      }

      // Sort header items: Top-to-Bottom, Left-to-Right
      headerItemsAbove.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 6) {
          return b.y - a.y;
        }
        return a.x - b.x;
      });

      // 4. Extract student rows from firstStudentRowIdx to bottom
      for (let r = firstStudentRowIdx; r < textLines.length; r++) {
        const rawLineCells = rawLines[r];
        if (!rawLineCells || rawLineCells.length < 2) continue;

        const cleanMergedCells = mergeRowCells(rawLineCells);
        if (cleanMergedCells.length < 2) continue;

        // Resolve client Name column index robustly
        let nameColIdx = -1;
        for (let c = 0; c < Math.min(4, cleanMergedCells.length); c++) {
          const txt = cleanMergedCells[c].text.replace(/\s+/g, '');
          if (txt !== '' && !['반', '번호', '반/번호', '학번', '학년', '성별', '연번'].some(k => txt.includes(k))) {
            const isPureNum = /^\d+$/.test(txt) || /^\d+\/\d+$/.test(txt);
            if (!isPureNum) {
              nameColIdx = c;
              break;
            }
          }
        }

        if (nameColIdx === -1) continue; // Skip to next row, not a valid student row

        const studentNameVal = cleanMergedCells[nameColIdx].text.trim();

        // Skip metrics/totals row
        const normName = studentNameVal.replace(/\s+/g, '');
        if (normName === '' || ['합계', '총점', '총합', '계', '원점수', '평균', '응시', '전체', '만점', '배점', '소계', '평가', '명판', '의사', '학교', '학급', '교사', '평가영역', '성적'].some(k => normName.includes(k))) {
          continue;
        }

        // Extract class and number from elements preceding the name cell
        let studentClassVal = '';
        let studentNumberVal = '';
        let exactStudentId = '';

        // Step 1: Look for any 5-digit number starting with the parsed grade (e.g. 10305 starting with 1)
        for (let c = 0; c < nameColIdx; c++) {
          const txt = cleanMergedCells[c].text.replace(/\s+/g, '');
          if (txt.length === 5 && txt.startsWith(parsedGrade) && /^\d+$/.test(txt)) {
            exactStudentId = txt;
            break;
          }
        }

        if (exactStudentId) {
          studentClassVal = parseInt(exactStudentId.substring(1, 3), 10).toString();
          studentNumberVal = parseInt(exactStudentId.substring(3), 10).toString();
        } else {
          // Step 2: Look for separators like "/" or "-" inside preceding cells
          for (let c = 0; c < nameColIdx; c++) {
            const txt = cleanMergedCells[c].text.replace(/\s+/g, '');
            const parsed = parseClassNumber(txt);
            if (parsed) {
              studentClassVal = parsed.classVal;
              studentNumberVal = parsed.numberVal;
              break;
            }
          }

          // Step 3: Handle individual cells step-by-step
          if (!studentClassVal || !studentNumberVal) {
            const numericValues: string[] = [];
            for (let c = 0; c < nameColIdx; c++) {
              const num = cleanMergedCells[c].text.replace(/\D/g, '');
              if (num) numericValues.push(num);
            }

            if (numericValues.length >= 2) {
              // If we have 3 numeric values, the first is often a sequential row number (e.g. [ "1", "3", "5" ])
              if (numericValues.length === 3) {
                studentClassVal = numericValues[1];
                studentNumberVal = numericValues[2];
              } else {
                studentClassVal = numericValues[0];
                studentNumberVal = numericValues[1];
              }
            } else if (numericValues.length === 1) {
              studentNumberVal = numericValues[0];
            }
          }
        }

        studentClassVal = (studentClassVal || '').replace(/\D/g, '').trim();
        studentNumberVal = (studentNumberVal || '').replace(/\D/g, '').trim();

        const numericNum = parseInt(studentNumberVal, 10);
        if (isNaN(numericNum) || numericNum <= 0) {
          continue; // Skip invalid student row numbers
        }

        if (!studentClassVal || studentClassVal.trim() === '') {
          studentClassVal = parsedClass;
        }

        const paddedClass = studentClassVal.padStart(2, '0');
        const paddedNum = studentNumberVal.padStart(2, '0');
        const finalStudentId = `${parsedGrade}${paddedClass}${paddedNum}`;

        if (seenStudentIds.has(finalStudentId)) {
          continue;
        }
        seenStudentIds.add(finalStudentId);

        // Map column headers using advanced coordinate-aligned parsing
        const columnHeaders: string[] = Array(cleanMergedCells.length).fill('');

        // Align the pre-collected header items to closest student row cells by X coordinate
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

        const studentRowData: { [key: string]: any } = {
          '학번': finalStudentId,
          '성명': studentNameVal
        };

        // Extract score columns (from index nameColIdx + 1 onwards)
        for (let col = nameColIdx + 1; col < cleanMergedCells.length; col++) {
          const rawHeader = columnHeaders[col] || '';
          const formattedHeader = cleanAndFormatHeaderName(rawHeader);

          if (formattedHeader === '' || ['반', '번호', '성명', '이름', '학년', '성별', '연번', '비고', '확인', '날인'].some(k => formattedHeader.includes(k))) {
            continue;
          }

          const scoreVal = cleanMergedCells[col].text.trim();
          studentRowData[formattedHeader] = scoreVal;
          allHeadersSet.add(formattedHeader);
        }

        allParsedRows.push(studentRowData);
      }
    }

    if (allParsedRows.length === 0) {
      return null;
    }

    const subHeaders = Array.from(allHeadersSet).filter(h => h !== '합계' && h !== '학번' && h !== '성명');
    const finalHeaders = ['학번', '성명', ...subHeaders];
    if (allHeadersSet.has('합계')) {
      finalHeaders.push('합계');
    }

    return {
      headers: finalHeaders,
      rows: allParsedRows
    };
  } catch (err) {
    console.error('Failed to parse PDF inside extractDataFromPdf utility:', err);
    return null;
  }
}

