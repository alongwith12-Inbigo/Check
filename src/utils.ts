/**
 * Utility functions for matching dynamic column names and cell styling
 */

export function findStudentIdKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('학번') || normalized.includes('학생번호') || normalized.includes('학적번호') || normalized === 'id';
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

export function findTeacherNameKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    // Prioritize specific terms like '교사명', '선생님이름', '교사이름' to avoid generic '이름' mismatch if other columns exist
    if (normalized.includes('교사명') || 
        normalized.includes('선생님이름') || 
        normalized.includes('교사이름') || 
        normalized.includes('교원명') ||
        normalized === '교사' || 
        normalized === '선생님' ||
        normalized === '강사') {
      return true;
    }
    // Then search for generic name keywords
    return normalized.includes('이름') || 
           normalized.includes('성함') || 
           normalized.includes('성명') || 
           normalized === 'name';
  });
}

export function findBirthdateKey(headers: string[]): string | undefined {
  return headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized.includes('생년월일') || normalized.includes('생년') || normalized.includes('생일') || normalized.includes('생일날짜') || normalized.includes('생년월');
  });
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
                         normalized.includes('고사');

  // Also check if the sample value is a valid percentage or positive number
  if (sampleValue !== null && sampleValue !== undefined && sampleValue !== '') {
    const num = Number(sampleValue);
    if (!isNaN(num) && typeof sampleValue !== 'boolean') {
      return true;
    }
  }

  return isKeywordMatch;
}
