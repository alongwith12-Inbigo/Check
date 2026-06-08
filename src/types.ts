/**
 * Types representing the database and states for the Universal Grade Lookup System
 */

export interface ExcelRow {
  [key: string]: any;
}

export interface EvaluationState {
  title: string;
  headers: string[];
  rows: ExcelRow[];
  uploadedAt: string | null;
}

export interface StudentCredentials {
  studentId: string;
  birthdate: string;
}
