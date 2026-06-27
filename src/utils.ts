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

