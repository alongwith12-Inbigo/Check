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

  const cleanSpace = title.replace(/\s+/g, '');
  // A precise check for "Total" / "Sum" to avoid false positives like "통계", "설계", "단계", "계획"
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
    return '';
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

    // Robust parsing of grade and class from targetGradeClass (e.g. "107")
    let parsedGrade = '1';
    let parsedClass = '7';

    const cleanInput = targetGradeClass.trim();
    const numMatch = cleanInput.match(/\d+/);
    if (numMatch) {
      const code = numMatch[0]; // e.g. "107"
      if (code.length === 3) {
        parsedGrade = code[0];
        parsedClass = parseInt(code.substring(1), 10).toString();
      } else if (code.length === 4) {
        parsedGrade = code.substring(0, 2);
        parsedClass = parseInt(code.substring(2), 10).toString();
      } else if (code.length === 2) {
        parsedGrade = code[0];
        parsedClass = parseInt(code[1], 10).toString();
      } else {
        parsedClass = parseInt(code, 10).toString();
      }
    } else {
      const gradeM = cleanInput.match(/(\d+)\s*학년/);
      const classM = cleanInput.match(/(\d+)\s*반/);
      if (gradeM) parsedGrade = gradeM[1];
      if (classM) parsedClass = classM[1];
    }

    // Class and Number parser
    const parseClassAndNumber = (text: string, defaultClass: string): { classVal: string; numVal: string } | null => {
      const norm = text.replace(/\s+/g, '');
      
      // 0. Extract any 5-digit numeric block (e.g. 10701, "10701번", "(10701)")
      const fiveDigitMatch = norm.match(/(\d)(\d{2})(\d{2})/);
      if (fiveDigitMatch) {
        return {
          classVal: parseInt(fiveDigitMatch[2], 10).toString(),
          numVal: parseInt(fiveDigitMatch[3], 10).toString()
        };
      }

      // 1. Check for 5-digit id (e.g. 10701)
      const id5Match = norm.match(/^(\d)(\d{2})(\d{1,2})$/);
      if (id5Match) {
        return {
          classVal: parseInt(id5Match[2], 10).toString(),
          numVal: parseInt(id5Match[3], 10).toString()
        };
      }

      // 2. Check for slash pattern (e.g. 7/1 or 1/7/1)
      if (norm.includes('/')) {
        const parts = norm.split('/');
        const digits = parts.map(p => p.replace(/\D/g, '')).filter(p => p !== '');
        if (digits.length >= 2) {
          if (digits.length >= 3) {
            return {
              classVal: parseInt(digits[1], 10).toString(),
              numVal: parseInt(digits[2], 10).toString()
            };
          } else {
            return {
              classVal: parseInt(digits[0], 10).toString(),
              numVal: parseInt(digits[1], 10).toString()
            };
          }
        }
      }

      // 3. Check for dash pattern (e.g. 7-1 or 1-7-1)
      if (norm.includes('-')) {
        const parts = norm.split('-');
        const digits = parts.map(p => p.replace(/\D/g, '')).filter(p => p !== '');
        if (digits.length >= 2) {
          if (digits.length >= 3) {
            return {
              classVal: parseInt(digits[1], 10).toString(),
              numVal: parseInt(digits[2], 10).toString()
            };
          } else {
            return {
              classVal: parseInt(digits[0], 10).toString(),
              numVal: parseInt(digits[1], 10).toString()
            };
          }
        }
      }

      // 4. Check for Korean formats like "7반1번"
      const koreanMatch = norm.match(/(\d+)반\s*(\d+)번/);
      if (koreanMatch) {
        return {
          classVal: parseInt(koreanMatch[1], 10).toString(),
          numVal: parseInt(koreanMatch[2], 10).toString()
        };
      }

      // 5. Fallback for single integer values
      if (/^\d+$/.test(norm)) {
        const val = parseInt(norm, 10);
        if (val > 0 && val <= 40) {
          return {
            classVal: defaultClass,
            numVal: val.toString()
          };
        }
      }

      return null;
    };

    interface ExtractedStudentData {
      student_id: string;
      student_name: string;
      scores: { [header: string]: string };
      total: string;
      rawHeadersList: string[];
      nameColIdx: number;
      totalColIdx: number;
    }

    const detectedStudentScores: ExtractedStudentData[] = [];
    const seenStudentIds = new Set<string>();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      if (items.length === 0) continue;

      // Group into physical rows by Y coordinate height tolerance (increased to 12 for robust line grouping)
      const tolerance = 12;
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

      // 1. Identify the table header row on this page
      let headerRowCells: MergedCell[] = [];
      let headerY = -Infinity;

      for (const y of sortedYKeys) {
        const lineItems = linesMap[y];
        const mergedRow = mergeRowCells(lineItems);
        const hasHeaderIndicators = mergedRow.some(cell => {
          const cleanedText = cell.text.replace(/\s+/g, '');
          return cleanedText.includes('반/번호') || 
                 (cleanedText.includes('반') && cleanedText.includes('번호')) || 
                 cleanedText.includes('성명') || 
                 cleanedText.includes('이름');
        });

        if (hasHeaderIndicators) {
          headerRowCells = mergedRow;
          headerY = y;
          break;
        }
      }

      // If no table header is detected on this page, fall back to the largest columns row
      if (headerRowCells.length === 0) {
        let maxLen = 0;
        let bestY = -Infinity;
        let bestCells: MergedCell[] = [];
        sortedYKeys.forEach(y => {
          const mRow = mergeRowCells(linesMap[y]);
          if (mRow.length > maxLen) {
            maxLen = mRow.length;
            bestY = y;
            bestCells = mRow;
          }
        });
        if (maxLen >= 3) {
          headerRowCells = bestCells;
          headerY = bestY + 20; // Assume we are below headers
        } else {
          continue; // Skip pages without tables
        }
      }

      const columnPositions = headerRowCells.map(c => c.x);

      // 2. Accumulate raw headers for each column on this page (and project multi-line titles)
      const rawHeaders = Array(columnPositions.length).fill('');
      items.forEach(item => {
        const x = item.transform[4] || 0;
        const y = item.transform[5] || 0;
        const str = item.str || '';
        if (str.trim() === '') return;

        // Cover header row and rows at or above it (plus 15px below it for "만점" numbers)
        if (y >= headerY - 15) {
          let closestIdx = -1;
          let minDist = Infinity;
          for (let index = 0; index < columnPositions.length; index++) {
            const dist = Math.abs(x - columnPositions[index]);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = index;
            }
          }
          if (closestIdx !== -1 && minDist < 60) {
            if (rawHeaders[closestIdx]) {
              rawHeaders[closestIdx] += ' ' + str;
            } else {
              rawHeaders[closestIdx] = str;
            }
          }
        }
      });

      // Find Name and Total column index mappings
      let nameColIdx = -1;
      let totalColIdx = -1;

      for (let c = 0; c < columnPositions.length; c++) {
        const headerText = rawHeaders[c].replace(/\s+/g, '');
        if (headerText.includes('성명') || headerText === '이름') {
          nameColIdx = c;
        }
        if (['합계', '총점', '총합', '계', '원점수'].some(k => headerText.includes(k))) {
          totalColIdx = c;
        }
      }

      if (nameColIdx === -1) {
        // Fallback: name is typically column 1 (second column)
        nameColIdx = 1;
      }
      if (totalColIdx === -1) {
        // Fallback: total/sum is typically the second last or last column
        totalColIdx = columnPositions.length - 2 >= nameColIdx ? columnPositions.length - 2 : columnPositions.length - 1;
      }

      // 3. Extract Student Rows
      let stopPage = false;
      for (const y of sortedYKeys) {
        if (stopPage) break;
        if (y >= headerY - 5) continue; // Skip header lines and titles

        const lineItems = linesMap[y];
        const mergedRow = mergeRowCells(lineItems);
        if (mergedRow.length < 2) continue; // Skip noise lines

        // A. Check for table footer summary keywords - stop parsing page if reached
        const firstCellText = mergedRow[0].text.replace(/\s+/g, '');
        const secondCellText = (mergedRow[1]?.text || '').replace(/\s+/g, '');
        
        const isFooterRow = [
          '응시생수', '총점', '평균', '학과응시생수', '학과총점', '학과평균', 
          '소계', '합계', '최고', '최저', '분포', '비율', '편차', '만점', '배점', 
          '기안자', '결재', '교장', '교감', '부장', '교사', '학교', '학급'
        ].some(k => firstCellText.includes(k) || secondCellText.includes(k));

        if (isFooterRow) {
          stopPage = true;
          break;
        }

        // B. Locate student ID/number in the ID column slot (nearest to columnPositions[0], increased tolerance to 120)
        let idCell: MergedCell | null = null;
        let minIdDist = Infinity;
        mergedRow.forEach(cell => {
          const dist = Math.abs(cell.x - columnPositions[0]);
          if (dist < minIdDist) {
            minIdDist = dist;
            idCell = cell;
          }
        });

        if (!idCell || minIdDist > 120) continue;

        const parsedCode = parseClassAndNumber((idCell as MergedCell).text, parsedClass);
        if (!parsedCode) continue; // Skip rows without class/number structure

        const classValParsed = parseInt(parsedCode.classVal, 10);
        const numValParsed = parseInt(parsedCode.numVal, 10);

        // Filter students of target class code only!
        if (classValParsed !== parseInt(parsedClass, 10)) {
          continue;
        }

        // General outlier sizing cap
        if (numValParsed > 45) continue;

        const paddedClass = parsedClass.padStart(2, '0');
        const paddedNum = parsedCode.numVal.padStart(2, '0');
        const finalStudentId = `${parsedGrade}${paddedClass}${paddedNum}`;

        if (seenStudentIds.has(finalStudentId)) continue;
        seenStudentIds.add(finalStudentId);

        // C. Clean and assign grades (scores) for evaluation subheaders
        const scores: { [header: string]: string } = {};
        let totalScore = '0';
        let studentName = '';

        for (let c = 0; c < columnPositions.length; c++) {
          let closestCell: MergedCell | null = null;
          let minDist = Infinity;
          mergedRow.forEach(cell => {
            const dist = Math.abs(cell.x - columnPositions[c]);
            if (dist < minDist) {
              minDist = dist;
              closestCell = cell;
            }
          });

          let cellText = (closestCell && minDist < 55) ? closestCell.text.trim() : '0';
          if (/^\d+\.00$/.test(cellText)) {
            cellText = parseFloat(cellText).toString();
          } else if (/^\d+\.\d+$/.test(cellText)) {
            const parsedFloat = parseFloat(cellText);
            if (!isNaN(parsedFloat)) {
              cellText = parsedFloat.toString();
            }
          }

          if (c === nameColIdx) {
            studentName = cellText === '0' ? '' : cellText;
          } else if (c > nameColIdx && c < totalColIdx) {
            const rawHeader = rawHeaders[c] || `영역_${c - nameColIdx}`;
            const cleanedHeader = cleanAndFormatHeaderName(rawHeader) || `영역_${c - nameColIdx}`;
            scores[cleanedHeader] = cellText;
          } else if (c === totalColIdx) {
            totalScore = cellText;
          }
        }

        detectedStudentScores.push({
          student_id: finalStudentId,
          student_name: studentName,
          scores,
          total: totalScore,
          rawHeadersList: rawHeaders,
          nameColIdx,
          totalColIdx
        });
      }
    }

    if (detectedStudentScores.length === 0) {
      console.warn('No active student rows found matching target requirements.');
      return null;
    }

    // Step 5: Master compilation and final standardization of columns & alignment
    const allAreaHeaderKeys = new Set<string>();
    detectedStudentScores.forEach(stud => {
      Object.keys(stud.scores).forEach(k => {
        allAreaHeaderKeys.add(k);
      });
    });

    const uniqueAreaHeaders = Array.from(allAreaHeaderKeys);
    if (uniqueAreaHeaders.length === 0) {
      console.warn('PDF parsed but found no evaluation column headers.');
      return null;
    }

    // Sort evaluation columns in their visual order of original index
    const sortedAreaHeaders = [...uniqueAreaHeaders].sort((a, b) => {
      const getMinColIdx = (hName: string) => {
        for (const stud of detectedStudentScores) {
          const idx = stud.rawHeadersList.findIndex(h => cleanAndFormatHeaderName(h) === hName);
          if (idx !== -1) return idx;
        }
        return 0;
      };
      return getMinColIdx(a) - getMinColIdx(b);
    });

    // Compute the absolute total max score from evaluation headers
    let totalMaxScore = 0;
    sortedAreaHeaders.forEach(sh => {
      const match = sh.match(/\((\d+)점\)/) || sh.match(/\(([\d.]+)점\)/);
      if (match && match[1]) {
        totalMaxScore += parseFloat(match[1]);
      }
    });

    const totalHeaderKey = totalMaxScore > 0 ? `합계 (${totalMaxScore}점)` : '합계';
    const finalHeaders = ['학번', '성명', ...sortedAreaHeaders, totalHeaderKey];

    // Compile ultimate student objects
    const finalParsedRows = detectedStudentScores.map(stud => {
      const row: any = {
        '학번': stud.student_id,
        '성명': stud.student_name || ''
      };

      // Fill empty cells
      sortedAreaHeaders.forEach(sh => {
        row[sh] = '0';
      });

      // Fill parsed evaluation scores
      Object.entries(stud.scores).forEach(([sh, value]) => {
        row[sh] = value;
      });

      // If original OCR total score is empty, use the computed fallback sum
      let sumOfAreas = 0;
      sortedAreaHeaders.forEach(sh => {
        sumOfAreas += parseFloat(row[sh]) || 0;
      });

      let finalTotal = stud.total;
      if (!finalTotal || finalTotal === '0') {
        finalTotal = sumOfAreas.toString();
      }

      row[totalHeaderKey] = finalTotal;
      return row;
    });

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

