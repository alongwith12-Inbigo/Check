/**
 * Utility functions for matching dynamic column names and cell styling
 */

export function findStudentIdKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('학번') || 
           normalized.includes('학생번호') || 
           normalized.includes('학적번호') || 
           normalized.includes('번호') || 
           normalized.includes('student') || 
           normalized === 'id' ||
           normalized === 'no' ||
           normalized === 'num';
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

/**
 * Robust matching for student IDs. Normalizes spaces/symbols/headers to digits.
 */
export function matchesStudentId(inputId: string, rowId: any): boolean {
  if (rowId === undefined || rowId === null) return false;
  const normInput = String(inputId).replace(/\D/g, '');
  const normRow = String(rowId).replace(/\D/g, '');
  
  if (!normInput || !normRow) {
    // Fallback to alphanumeric comparison if either has letters
    const rawInput = String(inputId).replace(/\s+/g, '').toLowerCase();
    const rawRow = String(rowId).replace(/\s+/g, '').toLowerCase();
    return rawInput === rawRow;
  }
  return normInput === normRow;
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
export function findTotalScoreKey(headers: string[], row: Record<string, any>, feedbackKeys: string[]): string | undefined {
  const studentIdKey = findStudentIdKey(headers);
  const birthdateKey = findBirthdateKey(headers);
  const nameKey = findNameKey(headers);
  const gradeKey = findGradeKey(headers);
  const classKey = findClassKey(headers);
  const numberKey = findNumberKey(headers);

  // Filter out identifiers and feedback rows
  const potentialScoreKeys = headers.filter(h => {
    if (h === studentIdKey || h === birthdateKey || h === nameKey || h === gradeKey || h === classKey || h === numberKey) return false;
    if (feedbackKeys.includes(h)) return false;
    
    // Check if the column exists in isScoreColumn
    return isScoreColumn(h, row[h]);
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
export function isScoreColumn(headerName: string, sampleValue: any): boolean {
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

  // Also check if the sample value is a valid percentage or positive number
  if (sampleValue !== null && sampleValue !== undefined && sampleValue !== '') {
    const num = Number(sampleValue);
    if (!isNaN(num) && typeof sampleValue !== 'boolean') {
      return true;
    }
  }

  return isKeywordMatch;
}
