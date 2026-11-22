/**
 * Utility functions for matching dynamic column names and cell styling
 */

export function findStudentIdKey(headers: string[]): string | undefined {
  // 1. First priority: exact '학번' or headers containing '학번' or '학생번호' / '학적번호'
  const primaryKey = headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '학번' || normalized.includes('학번') || normalized.includes('학적번호') || normalized.includes('학생번호');
  });
  if (primaryKey) return primaryKey;

  // 2. Second priority: headers containing 'student' or 'id'
  const secondaryKey = headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('student') || normalized === 'id';
  });
  if (secondaryKey) return secondaryKey;

  // 3. Fallback: headers containing '번호' or 'no' or 'num'
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('번호') || normalized === 'no' || normalized === 'num';
  });
}

export function findTeacherCodeKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('교사코드') || 
           normalized.includes('선생님코드') || 
           normalized.includes('강사코드') || 
           normalized.includes('교원코드') || 
           normalized === '코드' || 
           normalized.includes('코드') || 
           normalized.includes('아이디') || 
           normalized === 'id' || 
           normalized === 'code';
  });
}

export function findTeacherPasswordKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('비밀번호') || 
           normalized.includes('암호') || 
           normalized.includes('패스워드') || 
           normalized === '비밀' || 
           normalized === 'password' || 
           normalized === 'pw';
  });
}

export function findTeacherNameKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    if (normalized.includes('교사명') || 
        normalized.includes('선생님이름') || 
        normalized.includes('교사이름') || 
        normalized.includes('교원명') ||
        normalized === '교사' || 
        normalized === '선생님' ||
        normalized === '강사') {
      return true;
    }
    return normalized.includes('이름') || 
           normalized.includes('성함') || 
           normalized.includes('성명') || 
           normalized === 'name';
  });
}

export function findBirthdateKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('생년월일') || 
           normalized.includes('생년') || 
           normalized.includes('생일') || 
           normalized.includes('생일날짜') || 
           normalized.includes('생년월') || 
           normalized.includes('년월일') ||
           normalized.includes('birth');
  });
}

export function parseGradeAndClass(targetGradeClass: string): { grade: number; classVal: number } | null {
  if (!targetGradeClass) return null;
  const clean = targetGradeClass.trim();
  
  // 1. Check for Korean "학년" and "반" (e.g., "1학년 8반", "1학년8반")
  const korMatch = clean.match(/(\d+)\s*학년\s*(\d+)\s*반/);
  if (korMatch) {
    return { grade: parseInt(korMatch[1], 10), classVal: parseInt(korMatch[2], 10) };
  }

  // 2. Check for dash pattern (e.g., "1-8", "3-7")
  const dashMatch = clean.match(/(\d+)\s*-\s*(\d+)/);
  if (dashMatch) {
    return { grade: parseInt(dashMatch[1], 10), classVal: parseInt(dashMatch[2], 10) };
  }

  // 3. Check for 3-digit format (e.g., "108" -> grade 1, class 8; "307" -> grade 3, class 7)
  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    const code = numMatch[0];
    if (code.length === 3) {
      return { grade: parseInt(code[0], 10), classVal: parseInt(code.substring(1), 10) };
    } else if (code.length === 4) {
      return { grade: parseInt(code.substring(0, 2), 10), classVal: parseInt(code.substring(2), 10) };
    } else if (code.length === 2) {
      return { grade: parseInt(code[0], 10), classVal: parseInt(code[1], 10) };
    }
  }

  return null;
}

/**
 * Robust matching for student IDs. Normalizes spaces/symbols/headers to digits.
 */
export function matchesStudentId(inputId: string, rowId: any, targetGradeClass?: string): boolean {
  if (rowId === undefined || rowId === null) return false;
  const normInput = String(inputId).replace(/\D/g, '');
  const normRowRaw = String(rowId).trim();
  let normRow = normRowRaw.replace(/\D/g, '');
  
  if (!normInput || !normRow) return false;

  // Reconstruct 5-digit ID if the rowId contains only a 1 or 2-digit student number
  if (normRow.length > 0 && normRow.length <= 2 && targetGradeClass) {
    const parsed = parseGradeAndClass(targetGradeClass);
    if (parsed) {
      const grade = String(parsed.grade);
      const cls = String(parsed.classVal).padStart(2, '0');
      const num = normRow.padStart(2, '0');
      normRow = `${grade}${cls}${num}`;
    }
  }

  // 1. If exact numeric comparison matches (e.g. "30301" === "30301")
  if (normInput === normRow) return true;

  // 2. Parsed match for class/number formats (e.g., "7/1", "7-1", "07/01", "7반 1번")
  // Extract all digit chunks from the row cell (e.g., "7/1" -> ["7", "1"])
  const digitsInRow = normRowRaw.match(/\d+/g);
  if (digitsInRow) {
    if (digitsInRow.length === 2) {
      // E.g., Class 7, Number 1
      const parsedClass = parseInt(digitsInRow[0], 10);
      const parsedNum = parseInt(digitsInRow[1], 10);
      
      // Deconstruct 5-digit student ID (e.g., "10701" -> Grade 1, Class 7, Number 1)
      if (normInput.length === 5) {
        const inputGrade = parseInt(normInput.charAt(0), 10);
        const inputClass = parseInt(normInput.substring(1, 3), 10);
        const inputNum = parseInt(normInput.substring(3, 5), 10);
        
        if (inputClass === parsedClass && inputNum === parsedNum) {
          return true;
        }
      }
    } else if (digitsInRow.length === 3) {
      // E.g., Grade 1, Class 7, Number 1
      const parsedGrade = parseInt(digitsInRow[0], 10);
      const parsedClass = parseInt(digitsInRow[1], 10);
      const parsedNum = parseInt(digitsInRow[2], 10);
      
      if (normInput.length === 5) {
        const inputGrade = parseInt(normInput.charAt(0), 10);
        const inputClass = parseInt(normInput.substring(1, 3), 10);
        const inputNum = parseInt(normInput.substring(3, 5), 10);
        
        if (inputGrade === parsedGrade && inputClass === parsedClass && inputNum === parsedNum) {
          return true;
        }
      }
    } else if (digitsInRow.length === 1) {
      if (digitsInRow[0] === normInput) return true;
      
      // E.g. "701" matches "10701"
      if (digitsInRow[0].length === 3 && normInput.length === 5) {
        if (normInput.endsWith(digitsInRow[0])) {
          return true;
        }
      }
    }
  }

  // Fallback to standard alphanumeric string matching
  const rawInput = String(inputId).replace(/\s+/g, '').toLowerCase();
  const rawRow = String(rowId).replace(/\s+/g, '').toLowerCase();
  return rawInput === rawRow;
}

/**
 * Robust matching for birthdates (handles 6-digit vs 8-digit dates and symbols safely).
 */
export function matchesBirthdate(inputBirth: string, rowBirth: any): boolean {
  if (rowBirth === undefined || rowBirth === null) return false;
  const normInput = String(inputBirth).replace(/\D/g, '');
  const normRow = String(rowBirth).replace(/\D/g, '');
  
  if (!normInput || !normRow) return false;
  if (normInput === normRow) return true;
  
  // Handle 6-digit vs 8-digit comparison (e.g. 061215 vs 20061215)
  if (normInput.length === 6 && normRow.length === 8) {
    return normRow.endsWith(normInput) || normRow.substring(2) === normInput;
  }
  if (normInput.length === 8 && normRow.length === 6) {
    return normInput.endsWith(normRow) || normInput.substring(2) === normRow;
  }
  return false;
}

export function findFeedbackKey(headers: string[]): string[] {
  // Return all keys that contain feedback, reason, or comment-like keywords
  return headers.filter(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('피드백') || 
           normalized.includes('사유') || 
           normalized.includes('의견') || 
           normalized.includes('코멘트') || 
           normalized.includes('비고') ||
           normalized.includes('한마디');
  });
}

export function findGradeKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '학년' || normalized.includes('grade') || normalized === '학';
  });
}

export function findClassNumberKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '반/번호' || 
           normalized === '반번호' || 
           normalized === '반_번호' || 
           normalized === '반-번호' || 
           normalized === '반번' || 
           normalized.includes('학적') ||
           (normalized.includes('반') && normalized.includes('번호'));
  });
}

export function parseClassNumber(value: any): { classVal: string; numberVal: string } | null {
  if (value === undefined || value === null || value === '') return null;
  const cleaned = String(value).trim();
  
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const c = parts[0].replace(/\D/g, '');
    const n = parts[1].replace(/\D/g, '');
    if (c && n) return { classVal: c, numberVal: n };
  }
  
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const c = parts[0].replace(/\D/g, '');
    const n = parts[1].replace(/\D/g, '');
    if (c && n) return { classVal: c, numberVal: n };
  }

  const matches = cleaned.match(/(\d+)[^\d]+(\d+)/);
  if (matches && matches[1] && matches[2]) {
    return { classVal: matches[1], numberVal: matches[2] };
  }

  return null;
}

export function extractGradeFromTarget(targetGradeClass: string): string {
  const digits = String(targetGradeClass).replace(/\D/g, '');
  if (digits.length > 0) {
    return digits.charAt(0);
  }
  return '1';
}

export function findClassKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '반' || normalized.includes('class') || normalized === '학급';
  });
}

export function findNumberKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '번호' || normalized === 'no' || normalized.includes('number') || normalized === '번';
  });
}

export function findNameKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '이름' || normalized === '성명' || normalized.includes('name') || normalized.includes('학생명');
  });
}

/**
  * Finds the total score key (the last score-bearing column, excluding feedback and student identifiers)
  */
export function findTotalScoreKey(headers: string[], rows: Record<string, any>[] | Record<string, any>, feedbackKeys: string[]): string | undefined {
  const studentIdKey = findStudentIdKey(headers);
  const birthdateKey = findBirthdateKey(headers);
  const nameKey = findNameKey(headers);
  const gradeKey = findGradeKey(headers);
  const classKey = findClassKey(headers);
  const numberKey = findNumberKey(headers);

  const rowList = Array.isArray(rows) ? rows : [rows];

  // Filter out identifiers and feedback rows
  const potentialScoreKeys = headers.filter(h => {
    if (h === studentIdKey || h === birthdateKey || h === nameKey || h === gradeKey || h === classKey || h === numberKey) return false;
    if (feedbackKeys.includes(h)) return false;
    
    // Check if the column exists in isScoreColumn
    return isScoreColumn(h, rowList, h);
  });

  if (potentialScoreKeys.length === 0) return undefined;
  
  // The user specifies: "최종 계산하는 점수는 숫자의 마지막 열 (피드백 제외)만 숫자로 해서 수행평가 점수"
  // So we strictly take the absolute LAST potential score column
  return potentialScoreKeys[potentialScoreKeys.length - 1];
}

/**
 * Checks if a column represents a numeric score value
 * A score column is something like "점수", "총점", "1차", "태도", "수행", "평가"
 * Or if the student's value in this column is dynamically determined to be numeric.
 */
export function isScoreColumn(headerName: string, rowsOrSample: Record<string, any>[] | any, colKey?: string): boolean {
  const normalized = String(headerName).replace(/\s+/g, '').toLowerCase();
  
  // High-probability keywords for grades/scores
  const isKeywordMatch = normalized.includes('점수') || 
                         normalized.includes('점') || 
                         normalized.includes('성적') || 
                         normalized.includes('총합') || 
                         normalized.includes('총점') || 
                         normalized.includes('평가') || 
                         normalized.includes('과제') || 
                         normalized.includes('고사') ||
                         normalized.includes('합계') ||
                         normalized.includes('합') ||
                         normalized.includes('수행') ||
                         normalized.includes('총') ||
                         normalized.includes('비율') ||
                         normalized.includes('가중') ||
                         normalized.includes('결과');

  if (isKeywordMatch) return true;

  // If we receive an array of rows
  if (Array.isArray(rowsOrSample) && colKey) {
    for (const r of rowsOrSample) {
      if (r) {
        const val = r[colKey];
        if (val !== null && val !== undefined && val !== '') {
          const num = Number(val);
          if (!isNaN(num) && typeof val !== 'boolean') {
            return true;
          }
        }
      }
    }
  } else {
    // Fallback if we receive a single sample value
    if (rowsOrSample !== null && rowsOrSample !== undefined && rowsOrSample !== '') {
      const num = Number(rowsOrSample);
      if (!isNaN(num) && typeof rowsOrSample !== 'boolean') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a column header is a student metadata or non-score header
 * (e.g. 학번, 이름, 성명, 학년, 반, 번호, 비고, 서명, 확인 etc.)
 */
export function isMetadataOrNonScoreHeader(header: string): boolean {
  if (!header) return false;
  
  // Normalize header text by removing spaces
  let normalized = String(header).replace(/\s+/g, '').toLowerCase();
  
  if (normalized.startsWith('col_') || normalized.includes('col_') || normalized.includes('결시명칭')) {
    return true;
  }
  
  // Clean out common parentheticals like (100점), (30점) in brackets/parentheses
  normalized = normalized.replace(/\([^)]*\)/g, '');
  normalized = normalized.replace(/\[[^\]]*\]/g, '');
  
  const exclusions = [
    '학번', '성명', '이름', '학년', '성별', '연번', '비고', '확인', '날인', '생년월일', '학급', '순번', '서명', '교사', '강사', '비밀번호'
  ];
  
  if (exclusions.some(k => normalized.includes(k))) {
    return true;
  }
  
  // Checking for "반/번호", "반번호", "반_번호", "반-번호" or components
  if (normalized.includes('/') && (normalized.includes('반') || normalized.includes('번호'))) {
    return true;
  }
  if (normalized === '반' || normalized === '번호' || normalized === '반번' || normalized === '반/번호') {
    return true;
  }
  
  return false;
}

export interface GradeClassClassification {
  status: 'exact' | 'needs_review';
  targetGradeClasses: string[];
  reason?: string;
  source: 'targetGradeClass' | 'rows' | 'both' | 'unresolved';
}

export function normalizeGradeClassCode(grade: number, classVal: number): string | null {
  if (!Number.isInteger(grade) || !Number.isInteger(classVal)) return null;
  if (grade < 1 || grade > 9 || classVal < 1 || classVal > 99) return null;
  return `${grade}${String(classVal).padStart(2, '0')}`;
}

export function parseSingleGradeClassToken(token: string): string | null {
  const clean = String(token || '').trim();
  if (!clean) return null;

  // 1. "1학년 8반", "1학년8반"
  const korMatch = clean.match(/^(\d+)\s*학년\s*(\d+)\s*반$/);
  if (korMatch) {
    return normalizeGradeClassCode(parseInt(korMatch[1], 10), parseInt(korMatch[2], 10));
  }

  // 2. "1-8", "1/8", "1-08", "1-8반"
  const sepMatch = clean.match(/^(\d+)\s*[-/]\s*(\d+)\s*(?:반)?$/);
  if (sepMatch) {
    return normalizeGradeClassCode(parseInt(sepMatch[1], 10), parseInt(sepMatch[2], 10));
  }

  // 3. Exact 3-digit code e.g. "108", "108반"
  const codeMatch = clean.match(/^(\d{3})\s*(?:반)?$/);
  if (codeMatch) {
    const code = codeMatch[1];
    return normalizeGradeClassCode(parseInt(code[0], 10), parseInt(code.substring(1), 10));
  }

  return null;
}

export function parseTargetGradeClassList(raw?: string): { codes: string[]; hasInvalidToken: boolean } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { codes: [], hasInvalidToken: false };
  }

  const rawSegments = trimmed
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const codes = new Set<string>();
  let hasInvalidToken = false;

  for (const segment of rawSegments) {
    // Allow space-separated 3-digit codes like "101 102"
    if (/^\d{3}(\s+\d{3})+$/.test(segment)) {
      const subTokens = segment.split(/\s+/);
      for (const sub of subTokens) {
        const parsed = parseSingleGradeClassToken(sub);
        if (parsed) {
          codes.add(parsed);
        } else {
          hasInvalidToken = true;
        }
      }
      continue;
    }

    const parsed = parseSingleGradeClassToken(segment);
    if (parsed) {
      codes.add(parsed);
    } else {
      hasInvalidToken = true;
    }
  }

  return {
    codes: Array.from(codes).sort(),
    hasInvalidToken,
  };
}

function extractRowGradeClassCode(
  row: Record<string, any>,
  keys: {
    studentIdKey?: string;
    gradeKey?: string;
    classKey?: string;
    classNumberKey?: string;
  },
  singleFallbackCode: string | null
): string | null {
  if (!row || typeof row !== 'object') return null;

  const { studentIdKey, gradeKey, classKey, classNumberKey } = keys;

  // Read explicit grade column if available
  let explicitGrade: number | null = null;
  if (gradeKey && row[gradeKey] !== undefined && row[gradeKey] !== null && String(row[gradeKey]).trim() !== '') {
    const gDigits = String(row[gradeKey]).replace(/\D/g, '');
    if (gDigits) {
      const g = parseInt(gDigits, 10);
      if (g >= 1 && g <= 9) explicitGrade = g;
    }
  }

  // 1. Explicit grade + class columns
  if (explicitGrade !== null && classKey && row[classKey] !== undefined && row[classKey] !== null) {
    const cDigits = String(row[classKey]).replace(/\D/g, '');
    if (cDigits) {
      const normalized = normalizeGradeClassCode(explicitGrade, parseInt(cDigits, 10));
      if (normalized) return normalized;
    }
  }

  // 2. Explicit grade + class/number column
  if (explicitGrade !== null && classNumberKey && row[classNumberKey] !== undefined && row[classNumberKey] !== null) {
    const parsedCN = parseClassNumber(row[classNumberKey]);
    if (parsedCN) {
      const normalized = normalizeGradeClassCode(explicitGrade, parseInt(parsedCN.classVal, 10));
      if (normalized) return normalized;
    }
  }

  // 3. Student ID column
  if (studentIdKey && row[studentIdKey] !== undefined && row[studentIdKey] !== null) {
    const rawId = String(row[studentIdKey]).trim();
    if (rawId) {
      const chunks = rawId.match(/\d+/g);
      const allDigits = rawId.replace(/\D/g, '');

      if (chunks && chunks.length === 3) {
        // e.g. "1-8-1" or "1학년 8반 1번"
        const normalized = normalizeGradeClassCode(parseInt(chunks[0], 10), parseInt(chunks[1], 10));
        if (normalized) return normalized;
      } else if (chunks && chunks.length === 1) {
        if (allDigits.length === 5) {
          // Standard 5-digit student ID e.g. "10801"
          const normalized = normalizeGradeClassCode(parseInt(allDigits[0], 10), parseInt(allDigits.substring(1, 3), 10));
          if (normalized) return normalized;
        } else if (allDigits.length > 0 && allDigits.length <= 2 && singleFallbackCode) {
          // 1- or 2-digit number with explicit single targetGradeClass
          return singleFallbackCode;
        } else if (allDigits.length === 3 && singleFallbackCode) {
          // e.g. "801" matching singleFallbackCode "108"
          const clsFrom3 = parseInt(allDigits[0], 10);
          const fallbackCls = parseInt(singleFallbackCode.substring(1, 3), 10);
          if (clsFrom3 === fallbackCls) {
            return singleFallbackCode;
          }
        }
      } else if (chunks && chunks.length === 2) {
        // e.g. "8/1" or "8-1" (class & number only, no grade)
        const parsedCls = parseInt(chunks[0], 10);
        if (explicitGrade !== null) {
          const normalized = normalizeGradeClassCode(explicitGrade, parsedCls);
          if (normalized) return normalized;
        } else if (singleFallbackCode) {
          const fallbackCls = parseInt(singleFallbackCode.substring(1, 3), 10);
          if (parsedCls === fallbackCls) {
            return singleFallbackCode;
          }
        }
      }
    }
  }

  return null;
}

export function classifyEvaluationGradeClasses(evalItem: {
  uploadType?: 'excel' | 'pdf' | 'test_excel_sign';
  targetGradeClass?: string;
  headers?: string[];
  rows?: Record<string, any>[];
}): GradeClassClassification {
  const uploadType = evalItem.uploadType || 'excel';
  const headers = Array.isArray(evalItem.headers) ? evalItem.headers : [];
  const rows = Array.isArray(evalItem.rows) ? evalItem.rows : [];
  const parsedTarget = parseTargetGradeClassList(evalItem.targetGradeClass);
  const singleFallbackCode =
    !parsedTarget.hasInvalidToken && parsedTarget.codes.length === 1 ? parsedTarget.codes[0] : null;

  const studentIdKey = findStudentIdKey(headers);
  const gradeKey = findGradeKey(headers);
  const classKey = findClassKey(headers);
  const classNumberKey = findClassNumberKey(headers);

  if (uploadType === 'pdf' || uploadType === 'test_excel_sign') {
    if (parsedTarget.hasInvalidToken || parsedTarget.codes.length === 0) {
      return {
        status: 'needs_review',
        targetGradeClasses: [],
        reason: String(evalItem.targetGradeClass || '').trim()
          ? `대상 학년반 표기("${evalItem.targetGradeClass}")를 정확한 3자리 학년·반 코드로 판별할 수 없습니다.`
          : '대상 학년반(targetGradeClass)이 비어 있어 자동 판별할 수 없습니다.',
        source: 'unresolved',
      };
    }

    // Cross-check extracted rows if present to detect mismatches
    if (rows.length > 0 && (studentIdKey || (gradeKey && (classKey || classNumberKey)))) {
      const targetSet = new Set(parsedTarget.codes);
      const mismatchedClasses = new Set<string>();
      for (const row of rows) {
        const code = extractRowGradeClassCode(
          row,
          { studentIdKey, gradeKey, classKey, classNumberKey },
          singleFallbackCode
        );
        if (code && !targetSet.has(code)) {
          mismatchedClasses.add(code);
        }
      }
      if (mismatchedClasses.size > 0) {
        return {
          status: 'needs_review',
          targetGradeClasses: [],
          reason: `입력된 대상 학년반(${parsedTarget.codes.join(', ')}) 외의 학번(${Array.from(mismatchedClasses).sort().join(', ')})이 학생 행에서 감지되었습니다.`,
          source: 'unresolved',
        };
      }
    }

    return {
      status: 'exact',
      targetGradeClasses: parsedTarget.codes,
      source: 'targetGradeClass',
    };
  }

  // Excel uploadType
  if (parsedTarget.hasInvalidToken) {
    return {
      status: 'needs_review',
      targetGradeClasses: [],
      reason: `대상 학년반 표기("${evalItem.targetGradeClass}")를 정확한 학년·반 코드로 판별할 수 없습니다.`,
      source: 'unresolved',
    };
  }

  if (rows.length === 0) {
    if (parsedTarget.codes.length > 0) {
      return {
        status: 'exact',
        targetGradeClasses: parsedTarget.codes,
        source: 'targetGradeClass',
      };
    }
    return {
      status: 'needs_review',
      targetGradeClasses: [],
      reason: '학생 데이터 행이 비어 있고 대상 학년반도 지정되지 않았습니다.',
      source: 'unresolved',
    };
  }

  const rowClasses = new Set<string>();
  let unresolvedCount = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const hasAnyValue = Object.values(row).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== ''
    );
    if (!hasAnyValue) continue;

    const code = extractRowGradeClassCode(
      row,
      { studentIdKey, gradeKey, classKey, classNumberKey },
      singleFallbackCode
    );
    if (code) {
      rowClasses.add(code);
    } else {
      unresolvedCount++;
    }
  }

  if (unresolvedCount > 0) {
    return {
      status: 'needs_review',
      targetGradeClasses: [],
      reason: `전체 ${rows.length}개 행 중 ${unresolvedCount}개 행의 학년·반을 정확히 판별할 수 없습니다(예: 학년 없는 반/번호 표기 등).`,
      source: 'unresolved',
    };
  }

  if (rowClasses.size === 0) {
    return {
      status: 'needs_review',
      targetGradeClasses: [],
      reason: '학생 행에서 유효한 학년·반 코드를 추출할 수 없습니다.',
      source: 'unresolved',
    };
  }

  return {
    status: 'exact',
    targetGradeClasses: Array.from(rowClasses).sort(),
    source: singleFallbackCode ? 'both' : 'rows',
  };
}

export function normalizeGradeClassArray(arr?: string[]): string[] {
  if (!Array.isArray(arr)) return [];
  const cleaned = arr
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort();
}

export function areGradeClassArraysEqual(a?: string[], b?: string[]): boolean {
  const normA = normalizeGradeClassArray(a);
  const normB = normalizeGradeClassArray(b);
  if (normA.length !== normB.length) return false;
  return normA.every((val, idx) => val === normB[idx]);
}

export function parseManualMigrationInput(rawInput: string): {
  valid: boolean;
  targetGradeClasses: string[];
  error?: string;
} {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      targetGradeClasses: [],
      error: '대상 학년반 코드(예: 101, 102) 또는 ALL을 입력해 주세요.',
    };
  }

  if (trimmed.toUpperCase() === 'ALL') {
    return {
      valid: true,
      targetGradeClasses: ['ALL'],
    };
  }

  const parsed = parseTargetGradeClassList(trimmed);
  if (parsed.hasInvalidToken || parsed.codes.length === 0) {
    return {
      valid: false,
      targetGradeClasses: [],
      error: '유효하지 않은 형식이 포함되어 있습니다. 3자리 코드(예: 101, 102) 또는 1-1 형태로 입력해 주세요.',
    };
  }

  return {
    valid: true,
    targetGradeClasses: parsed.codes,
  };
}

/**
 * Safely determines whether an evaluation spreadsheet/PDF column header represents
 * unnecessary personal data (birthdate, password, resident ID, contact info, address)
 * while strictly preserving student IDs, names, class/number columns, scores, NCS units, and feedback.
 */
export function isSensitiveEvaluationColumn(header: string): boolean {
  const raw = String(header || '').trim();
  if (!raw) return false;

  // Never strip NCS bracketed competency unit columns (e.g. "[능력단위1: ...] ...")
  if (/^\[[^\]]+\]/.test(raw)) {
    return false;
  }

  // Strip parenthetical hints (e.g. "생년월일(8자리)") before checking exact/base labels
  const baseNormalized = raw
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase();

  if (!baseNormalized) return false;

  // Never strip essential student identification, name, class/number, or feedback columns
  if (
    baseNormalized === '학번' ||
    baseNormalized.includes('학번') ||
    baseNormalized.includes('학적번호') ||
    baseNormalized.includes('학생번호') ||
    baseNormalized.includes('studentid') ||
    baseNormalized === '번호' ||
    baseNormalized === '연번' ||
    baseNormalized === '순번' ||
    baseNormalized === '반' ||
    baseNormalized === '학년' ||
    baseNormalized === '학급' ||
    baseNormalized === '반번호' ||
    baseNormalized === '반/번호' ||
    findNameKey([raw]) ||
    findGradeKey([raw]) ||
    findClassKey([raw]) ||
    findNumberKey([raw]) ||
    findClassNumberKey([raw]) ||
    findFeedbackKey([raw]).length > 0
  ) {
    return false;
  }

  // Never strip columns clearly labeled with score/evaluation metrics
  const compactRaw = raw.replace(/\s+/g, '').toLowerCase();
  if (
    /\(\s*[\d.]+\s*점\s*\)/.test(compactRaw) ||
    /\[\s*[\d.]+\s*점\s*\]/.test(compactRaw) ||
    compactRaw.includes('만점') ||
    compactRaw.includes('배점') ||
    compactRaw.includes('점수') ||
    compactRaw.includes('총점') ||
    compactRaw.includes('합계') ||
    compactRaw.includes('성적')
  ) {
    return false;
  }

  // 1. Birthdate columns
  if (
    baseNormalized === '생년월일' ||
    baseNormalized.includes('생년월일') ||
    baseNormalized === '생년' ||
    baseNormalized === '생일' ||
    baseNormalized === '생일날짜' ||
    baseNormalized === '생년월' ||
    baseNormalized === '년월일' ||
    baseNormalized === 'birth' ||
    baseNormalized === 'birthdate' ||
    baseNormalized === 'birthday' ||
    baseNormalized === 'dob'
  ) {
    return true;
  }

  // 2. Password columns
  if (
    baseNormalized.includes('비밀번호') ||
    baseNormalized.includes('패스워드') ||
    baseNormalized === '암호' ||
    baseNormalized === '비밀' ||
    baseNormalized === 'password' ||
    baseNormalized === 'passwd' ||
    baseNormalized === 'pw'
  ) {
    return true;
  }

  // 3. Resident Registration Number (주민등록번호) columns
  if (
    baseNormalized.includes('주민등록') ||
    baseNormalized.includes('주민번호') ||
    baseNormalized.includes('외국인등록번호') ||
    baseNormalized === 'ssn' ||
    baseNormalized === 'rrn' ||
    baseNormalized === 'residentid'
  ) {
    return true;
  }

  // 4. Contact / phone / email / home address columns
  if (
    baseNormalized.includes('연락처') ||
    baseNormalized.includes('전화번호') ||
    baseNormalized.includes('휴대폰') ||
    baseNormalized.includes('휴대전화') ||
    baseNormalized.includes('핸드폰') ||
    baseNormalized.includes('폰번호') ||
    baseNormalized.includes('비상연락') ||
    baseNormalized.includes('집전화') ||
    baseNormalized.includes('이메일') ||
    baseNormalized.includes('메일주소') ||
    baseNormalized === 'email' ||
    baseNormalized === 'phone' ||
    baseNormalized === 'mobile' ||
    baseNormalized === 'tel' ||
    baseNormalized === 'cellphone' ||
    baseNormalized === 'contact' ||
    baseNormalized === '집주소' ||
    baseNormalized === '현주소' ||
    baseNormalized === '거주지' ||
    baseNormalized === '도로명주소' ||
    baseNormalized === '상세주소'
  ) {
    return true;
  }

  return false;
}

export function stripSensitiveEvaluationColumns(
  headers: string[],
  rows: Record<string, any>[]
): {
  headers: string[];
  rows: Record<string, any>[];
  removedHeaders: string[];
} {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  const removedHeaders: string[] = [];
  const removedHeaderSet = new Set<string>();
  const filteredHeaders: string[] = [];

  for (const h of safeHeaders) {
    if (isSensitiveEvaluationColumn(h)) {
      removedHeaders.push(h);
      removedHeaderSet.add(h);
    } else {
      filteredHeaders.push(h);
    }
  }

  const sanitizedRows = safeRows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const cleanedRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      if (removedHeaderSet.has(key) || isSensitiveEvaluationColumn(key)) {
        if (!removedHeaderSet.has(key)) {
          removedHeaders.push(key);
          removedHeaderSet.add(key);
        }
        continue;
      }
      cleanedRow[key] = value;
    }
    return cleanedRow;
  });

  return {
    headers: filteredHeaders,
    rows: sanitizedRows,
    removedHeaders,
  };
}

/**
 * Validates that extracted evaluation headers and rows contain the minimum fields
 * needed for student score lookup (a student identifier column, at least one
 * non-metadata score/evaluation column, and at least one row with both a student ID
 * and a non-empty score value).
 */
export function isValidExtractedEvaluationData(
  headers: string[],
  rows: Record<string, any>[]
): boolean {
  if (!Array.isArray(headers) || headers.length < 2) return false;
  if (!Array.isArray(rows) || rows.length === 0) return false;

  const cleanHeaders = headers.filter((h) => typeof h === 'string' && h.trim() !== '');
  if (cleanHeaders.length < 2) return false;

  const studentIdKey = findStudentIdKey(cleanHeaders);
  if (!studentIdKey) return false;

  const scoreHeaders = cleanHeaders.filter((h) => !isMetadataOrNonScoreHeader(h));
  if (scoreHeaders.length === 0) return false;

  return rows.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const rawStudentId = row[studentIdKey];
    if (rawStudentId === undefined || rawStudentId === null || String(rawStudentId).trim() === '') {
      return false;
    }
    return scoreHeaders.some((sh) => {
      const val = row[sh];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });
  });
}



