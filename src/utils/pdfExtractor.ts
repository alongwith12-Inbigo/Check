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

  // Look for Total Score indicator
  const isTotal = ['합계', '합 계', '총점', '총합', '계', '원점수', '합'].some(k => title.replace(/\s+/g, '').includes(k));

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

    // Robust parsing of grade and class from targetGradeClass
    let parsedGrade = '1';
    let parsedClass = '';

    const cleanInput = targetGradeClass.trim();
    const numbersInTarget = cleanInput.match(/\d+/g)?.filter(num => num.length !== 4) || [];

    if (numbersInTarget.length >= 2) {
      parsedGrade = numbersInTarget[0];
      parsedClass = parseInt(numbersInTarget[1], 10).toString();
    } else if (numbersInTarget.length === 1) {
      const numStr = numbersInTarget[0];
      if (numStr.length === 3) {
        parsedGrade = numStr[0];
        parsedClass = parseInt(numStr.substring(1), 10).toString();
      } else if (numStr.length === 2) {
        parsedGrade = numStr[0];
        parsedClass = parseInt(numStr[1], 10).toString();
      } else {
        parsedGrade = '1';
        parsedClass = parseInt(numStr, 10).toString();
      }
    } else {
      const gradeM = cleanInput.match(/(\d+)\s*학년/);
      const classM = cleanInput.match(/(\d+)\s*반/);
      if (gradeM) parsedGrade = gradeM[1];
      if (classM) parsedClass = classM[1];
    }

    // Stat/header keywords to filter out non-student names
    const statsKeywords = [
      '합계', '총점', '총합', '계', '원점수', '평균', '응시', '전체', '만점', '배점', 
      '소계', '평가', '명판', '의사', '학교', '학급', '교사', '평가영역', '성적', 
      '과목', '최고', '최저', '분포', '비율', '편차', '학년', '성명', '이름', '반/번호', '번호', '과정'
    ];

    // Helper to identify if a row of merged cells is a valid student row
    const checkStudentRow = (cells: MergedCell[]) => {
      if (cells.length < 2) return null;

      let nameColIdx = -1;
      let nameVal = '';

      for (let i = 0; i < Math.min(5, cells.length); i++) {
        const text = cells[i].text.trim();
        const norm = text.replace(/\s+/g, '');

        if (norm === '') continue;
        if (statsKeywords.some(k => norm.includes(k))) continue;

        // Name is usually non-numeric and not pure symbols (e.g. "7/1", "10715")
        const isNumericOrSymbol = /^[0-9./\s-]+$/.test(text);
        if (isNumericOrSymbol) continue;

        // Name length bounds (usually 1 ~ 25 characters)
        if (text.length > 25) continue;

        nameColIdx = i;
        nameVal = text;
        break;
      }

      if (nameColIdx === -1) return null;

      // Extract class & student number from prior columns
      let detectedClass = '';
      let detectedNum = '';

      for (let i = nameColIdx - 1; i >= 0; i--) {
        const rawText = cells[i].text.replace(/\s+/g, '');

        // Pattern 1: 5-digit academic ID (e.g. 10715)
        if (rawText.length === 5 && rawText.startsWith(parsedGrade) && /^\d+$/.test(rawText)) {
          detectedClass = parseInt(rawText.substring(1, 3), 10).toString();
          detectedNum = parseInt(rawText.substring(3), 10).toString();
          break;
        }

        // Pattern 2: Slash (7/15)
        if (rawText.includes('/')) {
          const parts = rawText.split('/');
          const cv = parts[0].replace(/\D/g, '');
          const nv = parts[1].replace(/\D/g, '');
          if (cv && nv && parseInt(nv, 10) > 0) {
            detectedClass = cv;
            detectedNum = nv;
            break;
          }
        }

        // Pattern 3: Dash (7-15)
        if (rawText.includes('-')) {
          const parts = rawText.split('-');
          const cv = parts[0].replace(/\D/g, '');
          const nv = parts[1].replace(/\D/g, '');
          if (cv && nv && parseInt(nv, 10) > 0) {
            detectedClass = cv;
            detectedNum = nv;
            break;
          }
        }
      }

      // Pattern 4: Separate discrete numbers in columns before Name
      if (!detectedClass || !detectedNum) {
        const numericValues: string[] = [];
        for (let i = 0; i < nameColIdx; i++) {
          const onlyNum = cells[i].text.replace(/\D/g, '');
          if (onlyNum) {
            numericValues.push(onlyNum);
          }
        }

        if (numericValues.length >= 2) {
          if (numericValues.length === 3) {
            detectedClass = parseInt(numericValues[1], 10).toString();
            detectedNum = parseInt(numericValues[2], 10).toString();
          } else {
            detectedClass = parseInt(numericValues[0], 10).toString();
            detectedNum = parseInt(numericValues[1], 10).toString();
          }
        } else if (numericValues.length === 1) {
          detectedNum = parseInt(numericValues[0], 10).toString();
          detectedClass = parsedClass || '1';
        }
      }

      detectedClass = (detectedClass || '').trim();
      detectedNum = (detectedNum || '').trim();

      const numValParsed = parseInt(detectedNum, 10);
      if (isNaN(numValParsed) || numValParsed <= 0) {
        return null;
      }

      if (!detectedClass) {
        detectedClass = parsedClass || '1';
      }

      return {
        classVal: detectedClass,
        numberVal: detectedNum,
        nameVal,
        nameColIdx
      };
    };

    interface RecognizedStudent {
      classVal: string;
      numberVal: string;
      nameVal: string;
      nameColIdx: number;
      cells: MergedCell[];
      y: number;
    }

    const detectedStudents: RecognizedStudent[] = [];
    const headerItemsAbove: any[] = [];
    let absoluteFirstStudentY = -Infinity;

    // Step 1: Collect cells & identify first student line Y across all pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      if (items.length === 0) continue;

      // Group into physical visual rows
      const tolerance = 6;
      const linesMap: { [y: number]: any[] } = {};

      items.forEach(item => {
        const str = item.str || '';
        if (str.trim() === '') return;

        const x = item.transform[4] || 0;
        const y = item.transform[5] || 0;

        const foundY = Object.keys(linesMap).map(Number).find(keyY => Math.abs(keyY - y) <= tolerance);
        if (foundY !== undefined) {
          linesMap[foundY].push({ text: str, x, y });
        } else {
          linesMap[y] = [{ text: str, x, y }];
        }
      });

      const sortedYKeys = Object.keys(linesMap).map(Number).sort((a, b) => b - a);

      let firstStudentYInPage = -Infinity;
      const pageStudents: RecognizedStudent[] = [];

      sortedYKeys.forEach(y => {
        const lineItems = linesMap[y];
        const mergedRow = mergeRowCells(lineItems);
        const meta = checkStudentRow(mergedRow);
        if (meta) {
          pageStudents.push({
            classVal: meta.classVal,
            numberVal: meta.numberVal,
            nameVal: meta.nameVal,
            nameColIdx: meta.nameColIdx,
            cells: mergedRow,
            y
          });
          if (y > firstStudentYInPage) {
            firstStudentYInPage = y;
          }
        }
      });

      if (firstStudentYInPage > absoluteFirstStudentY) {
        absoluteFirstStudentY = firstStudentYInPage;
      }

      pageStudents.forEach(st => detectedStudents.push(st));

      // Separate header candidate items purely above student region in this page
      items.forEach(item => {
        const y = item.transform[5] || 0;
        const x = item.transform[4] || 0;
        const str = item.str || '';
        if (str.trim() !== '') {
          if (firstStudentYInPage === -Infinity || y > firstStudentYInPage + 4) {
            headerItemsAbove.push({ text: str, x, y });
          }
        }
      });
    }

    if (detectedStudents.length === 0) {
      console.warn('No student rows could be parsed from PDF pages.');
      return null;
    }

    // Step 2: Establish a unified Layout Model (Anchor-Row column mapping)
    const sortedCompleted = [...detectedStudents].sort((a, b) => b.cells.length - a.cells.length);
    const anchorRow = sortedCompleted[0];
    const columnXPositions = anchorRow.cells.map(c => c.x);

    // Step 3: Align and merge all upper header pieces with standard columns layout
    const rawColumnHeaders: string[] = Array(columnXPositions.length).fill('');
    headerItemsAbove.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 6) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    headerItemsAbove.forEach(item => {
      let closestColIdx = -1;
      let minDistance = Infinity;

      for (let c = 0; c < columnXPositions.length; c++) {
        const dist = Math.abs(item.x - columnXPositions[c]);
        if (dist < minDistance) {
          minDistance = dist;
          closestColIdx = c;
        }
      }

      if (closestColIdx !== -1 && minDistance < 65) {
        if (rawColumnHeaders[closestColIdx]) {
          rawColumnHeaders[closestColIdx] += ' ' + item.text;
        } else {
          rawColumnHeaders[closestColIdx] = item.text;
        }
      }
    });

    // Step 4: Clean, structure, and assemble the schema attributes
    const nameColIdxInAnchor = anchorRow.nameColIdx;
    const finalHeaders: string[] = ['학번', '성명'];
    const subHeaders: string[] = [];
    const allHeadersSet = new Set<string>();

    const colIndexToKeyMap: { [col: number]: string } = {};

    for (let c = nameColIdxInAnchor + 1; c < columnXPositions.length; c++) {
      const rawHeader = rawColumnHeaders[c] || '';
      const formattedHeader = cleanAndFormatHeaderName(rawHeader);

      if (
        formattedHeader === '' || 
        ['반', '번호', '성명', '이름', '학년', '성별', '연번', '비고', '확인', '날인'].some(k => formattedHeader.includes(k))
      ) {
        continue;
      }

      colIndexToKeyMap[c] = formattedHeader;
      if (!formattedHeader.startsWith('합계')) {
        subHeaders.push(formattedHeader);
        allHeadersSet.add(formattedHeader);
      }
    }

    // Calculate dynamic summation max targets to build correct total text header "합계 (70점)"
    let totalMaxScore = 0;
    subHeaders.forEach(sh => {
      const match = sh.match(/\((\d+)점\)/) || sh.match(/\(([\d.]+)점\)/);
      if (match && match[1]) {
        totalMaxScore += parseFloat(match[1]);
      }
    });

    finalHeaders.push(...subHeaders);
    let totalHeaderKey = '합계';
    if (totalMaxScore > 0) {
      totalHeaderKey = `합계 (${totalMaxScore}점)`;
    }
    finalHeaders.push(totalHeaderKey);

    // Step 5: Process student row entries on standard layouts aligning coordinates tightly
    const finalParsedRows: any[] = [];
    const seenStudentIds = new Set<string>();

    detectedStudents.forEach(stud => {
      const studentClassVal = stud.classVal || parsedClass;
      const paddedClass = studentClassVal.padStart(2, '0');
      const paddedNum = stud.numberVal.padStart(2, '0');
      const finalStudentId = `${parsedGrade}${paddedClass}${paddedNum}`;

      if (seenStudentIds.has(finalStudentId)) {
        return;
      }
      seenStudentIds.add(finalStudentId);

      const rowData: any = {
        '학번': finalStudentId,
        '성명': stud.nameVal
      };

      finalHeaders.forEach(h => {
        if (h !== '학번' && h !== '성명') {
          rowData[h] = '0';
        }
      });

      stud.cells.forEach(cell => {
        let nearestIdx = -1;
        let minDistance = Infinity;

        for (let idx = 0; idx < columnXPositions.length; idx++) {
          const dist = Math.abs(cell.x - columnXPositions[idx]);
          if (dist < minDistance) {
            minDistance = dist;
            nearestIdx = idx;
          }
        }

        if (nearestIdx !== -1 && minDistance < 40) {
          const headerKey = colIndexToKeyMap[nearestIdx];
          if (headerKey) {
            let scoreVal = cell.text.trim();
            if (/^\d+\.00$/.test(scoreVal)) {
              scoreVal = parseFloat(scoreVal).toString();
            } else if (/^\d+\.\d+$/.test(scoreVal)) {
              const parsed = parseFloat(scoreVal);
              if (!isNaN(parsed)) {
                scoreVal = parsed.toString();
              }
            }
            rowData[headerKey] = scoreVal;
          }
        }
      });

      let sumOfAreas = 0;
      subHeaders.forEach(sh => {
        const val = parseFloat(rowData[sh]) || 0;
        sumOfAreas += val;
      });

      let parsedTotalScoreVal = '';
      for (let idx = nameColIdxInAnchor + 1; idx < columnXPositions.length; idx++) {
        const headerKey = colIndexToKeyMap[idx];
        if (headerKey && headerKey.startsWith('합계')) {
          parsedTotalScoreVal = rowData[headerKey] || '';
          break;
        }
      }

      if (parsedTotalScoreVal && parsedTotalScoreVal !== '0') {
        rowData[totalHeaderKey] = parsedTotalScoreVal;
      } else {
        rowData[totalHeaderKey] = sumOfAreas.toString();
      }

      let totalRaw = rowData[totalHeaderKey];
      if (/^\d+\.00$/.test(totalRaw)) {
        rowData[totalHeaderKey] = parseFloat(totalRaw).toString();
      } else if (/^\d+\.\d+$/.test(totalRaw)) {
        const parsed = parseFloat(totalRaw);
        if (!isNaN(parsed)) {
          rowData[totalHeaderKey] = parsed.toString();
        }
      }

      finalParsedRows.push(rowData);
    });

    if (finalParsedRows.length === 0) {
      return null;
    }

    finalParsedRows.sort((a, b) => a['학번'].localeCompare(b['학번']));

    return {
      headers: finalHeaders,
      rows: finalParsedRows
    };
  } catch (err) {
    console.error('Failed to parse PDF inside extractDataFromPdf utility:', err);
    return null;
  }
}

