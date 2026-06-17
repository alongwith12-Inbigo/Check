/**
 * Types representing the database and states for the Universal Grade Lookup System
 */

export interface ExcelRow {
  [key: string]: any;
}

export interface EvaluationState {
  id?: string;
  teacherCode?: string;
  title: string;
  subject?: string;
  round?: string;
  evaluationDetailName?: string;
  maxScore?: string;
  reflectRate?: string;
  headers: string[];
  rows: ExcelRow[];
  uploadedAt: string | null;
  uploadType?: 'excel' | 'pdf';
  pdfBase64?: string;
  pdfFileName?: string;
  targetGradeClass?: string;
}

export interface Teacher {
  code: string;
  name: string;
  password?: string;
}

export interface StudentCredentials {
  studentId: string;
  birthdate: string;
}

export interface RegisteredStudent {
  studentId: string;
  name: string;
  birthdate: string;
  password?: string;
}

export interface StudentResultItem {
  evaluationId: string;
  evaluationTitle: string;
  subject: string;
  round: string;
  evaluationDetailName: string;
  maxScore: string;
  reflectRate?: string;
  headers: string[];
  row: ExcelRow;
  teacherCode?: string;
  uploadType?: 'excel' | 'pdf';
  pdfBase64?: string;
  pdfFileName?: string;
  targetGradeClass?: string;
}

export interface StudentSession {
  studentId: string;
  birthdate: string;
  studentName: string;
  teacherName: string;
  results: StudentResultItem[];
  teacherCode?: string;
}

export interface ExcelUpload {
  id: string;
  fileName: string;
  uploadedAt: string;
  recordCount: number;
}
