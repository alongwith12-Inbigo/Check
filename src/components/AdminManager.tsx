import React, { useState, useRef } from 'react';
import { 
  Users, 
  Trash2, 
  Upload, 
  FileSpreadsheet, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  Info,
  Edit,
  UserPlus,
  ArrowRight,
  GraduationCap,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Teacher, RegisteredStudent, ExcelUpload } from '../types';
import { 
  findTeacherCodeKey, 
  findTeacherNameKey, 
  findTeacherPasswordKey,
  findStudentIdKey,
  findBirthdateKey,
  findGradeKey,
  findClassKey,
  findNumberKey
} from '../utils';

interface AdminManagerProps {
  teachers: Teacher[];
  onUpdateTeachers: (newTeachers: Teacher[]) => void;
  onDeleteTeacher: (code: string, name: string) => void;
  onLogout: () => void;
  allStudents: RegisteredStudent[];
  onUpdateStudents: (newStudents: RegisteredStudent[]) => void;
  onDeleteStudent: (studentId: string, name: string) => void;
  excelUploads: ExcelUpload[];
  onSaveExcelUpload: (id: string, fileName: string, recordCount: number) => Promise<void>;
  privacyPolicy: string;
  privacyFile: { fileName: string; fileBase64: string } | null;
  onUpdatePrivacyPolicy: (content: string, fileData?: { fileName: string; fileBase64: string } | null) => Promise<void>;
}

export default function AdminManager({ 
  teachers, 
  onUpdateTeachers, 
  onDeleteTeacher, 
  onLogout,
  allStudents,
  onUpdateStudents,
  onDeleteStudent,
  excelUploads,
  onSaveExcelUpload,
  privacyPolicy,
  privacyFile,
  onUpdatePrivacyPolicy
}: AdminManagerProps) {
  // Navigation state
  const [activeTab, setActiveTab] = useState<'teachers' | 'students' | 'privacy'>('teachers');

  // Privacy Policy editor local states
  const [privacyEditorText, setPrivacyEditorText] = useState(privacyPolicy || '');
  const [localPrivacyFile, setLocalPrivacyFile] = useState<{ fileName: string; fileBase64: string } | null>(null);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [dragPrivacyActive, setDragPrivacyActive] = useState(false);
  const privacyFileInputRef = useRef<HTMLInputElement>(null);

  // Sync privacy policy content and file from database
  React.useEffect(() => {
    if (privacyPolicy) {
      setPrivacyEditorText(privacyPolicy);
    }
  }, [privacyPolicy]);

  React.useEffect(() => {
    if (privacyFile) {
      setLocalPrivacyFile(privacyFile);
    } else {
      setLocalPrivacyFile(null);
    }
  }, [privacyFile]);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Messages state
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // State for individual teacher registration & edit
  const [editingTeacherCode, setEditingTeacherCode] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // State for individual student registration & edit
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentBirthdate, setNewStudentBirthdate] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePrivacyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      setErrorMsg('용량이 너무 큽니다. 20MB 이하의 파일만 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLocalPrivacyFile({
          fileName: file.name,
          fileBase64: base64
        });
        setSuccessMsg(`"${file.name}" 파일이 대기열에 추가되었습니다. 아래 '상위 약관 변경내용 저장' 버튼을 누르시면 업로드가 완료됩니다.`);
        setErrorMsg('');
      }
    };
    reader.onerror = () => {
      setErrorMsg('파일을 읽어들이는 도중 에러가 발생했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handlePrivacyDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragPrivacyActive(true);
    } else if (e.type === "dragleave") {
      setDragPrivacyActive(false);
    }
  };

  const handlePrivacyDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragPrivacyActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setErrorMsg('용량이 너무 큽니다. 20MB 이하의 파일만 업로드할 수 있습니다.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setLocalPrivacyFile({
            fileName: file.name,
            fileBase64: base64
          });
          setSuccessMsg(`"${file.name}" 파일이 드롭되었습니다. 아래 '상위 약관 변경내용 저장' 버튼을 누르면 업로드가 완료됩니다.`);
          setErrorMsg('');
        }
      };
      reader.onerror = () => {
        setErrorMsg('파일을 읽어들이는 도중 에러가 발생했습니다.');
      };
      reader.readAsDataURL(file);
    }
  };

  // Dialog Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    actionText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Bulk Teachers XLSX processing
  const processTeachersExcel = (file: File) => {
    setErrorMsg('');
    setSuccessMsg('');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
        const headersJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        const cleanHeaders = (headersJson || []).filter(h => h && String(h).trim() !== "");

        if (cleanHeaders.length === 0 || rawRows.length === 0) {
          setErrorMsg('엑셀 파일 분석 실패: 관리 테이블에 포함된 유효한 행을 발견하지 못했습니다.');
          return;
        }

        const codeHeaderKey = findTeacherCodeKey(cleanHeaders);
        const nameHeaderKey = findTeacherNameKey(cleanHeaders);
        const passwordHeaderKey = findTeacherPasswordKey(cleanHeaders);

        if (!codeHeaderKey || !nameHeaderKey) {
          setErrorMsg(
            `필수 컬럼 판단 오류: 업로드된 엑셀에서 '교사코드' 또는 '선생님이름'이 매핑되는 컬럼을 찾을 수 없습니다.\n` +
            `헤더 목록: [${cleanHeaders.join(', ')}]`
          );
          return;
        }

        let addedCount = 0;
        let skippedCount = 0;
        const updatedTeachers = [...teachers];

        for (const row of rawRows) {
          const rawCode = String(row[codeHeaderKey]).replace(/\s+/g, '');
          const rawName = String(row[nameHeaderKey]).trim();
          const rawPassword = passwordHeaderKey ? String(row[passwordHeaderKey]).replace(/\s+/g, '') : '';

          if (!rawCode || !rawName) {
            skippedCount++;
            continue;
          }

          let formattedCode = rawCode.replace(/\D/g, '');
          if (formattedCode.length > 0 && formattedCode.length < 3) {
            formattedCode = formattedCode.padStart(3, '0');
          }

          if (formattedCode.length !== 3) {
            skippedCount++;
            continue;
          }

          const teaItem: Teacher = {
            code: formattedCode,
            name: rawName,
            password: rawPassword || '1004'
          };

          const idx = updatedTeachers.findIndex(t => t.code === formattedCode);
          if (idx >= 0) {
            updatedTeachers[idx] = teaItem;
          } else {
            updatedTeachers.push(teaItem);
          }
          addedCount++;
        }

        updatedTeachers.sort((a, b) => {
          const numA = parseInt(a.code, 10);
          const numB = parseInt(b.code, 10);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return a.code.localeCompare(b.code);
        });

        onUpdateTeachers(updatedTeachers);
        onSaveExcelUpload('teachers', file.name, addedCount);
        setSuccessMsg(
          `교사 엑셀 등록 성공: 총 ${addedCount}명의 선생님 계정이 분석, 반영되었습니다.` +
          (skippedCount > 0 ? ` (교사코드 3자리 누락 등 부적합 형태 ${skippedCount}줄 무시 처리)` : '')
        );
      } catch (err) {
        console.error(err);
        setErrorMsg('엑셀 파일을 파싱하여 교사 정보를 등록하지 못했습니다. 적절한 .xlsx 통합 문서를 열어주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Bulk Students XLSX processing
  const processStudentsExcel = (file: File) => {
    setErrorMsg('');
    setSuccessMsg('');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
        const headersJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        const cleanHeaders = (headersJson || []).filter(h => h && String(h).trim() !== "");

        if (cleanHeaders.length === 0 || rawRows.length === 0) {
          setErrorMsg('학생 엑셀 파일 분석 실패: 테이블에 로드할 행 데이터가 존재하지 않습니다.');
          return;
        }

        let studentIdKey = findStudentIdKey(cleanHeaders);
        const birthdateKey = findBirthdateKey(cleanHeaders);
        
        const gradeKey = findGradeKey(cleanHeaders);
        const classKey = findClassKey(cleanHeaders);
        const numberKey = findNumberKey(cleanHeaders);

        let processedRows = [...rawRows];

        // Dynamically compile "학번" from "학년", "반", "번호" columns if present
        if (!studentIdKey && gradeKey && classKey && numberKey) {
          studentIdKey = '학번';
          processedRows = rawRows.map(row => {
            const gVal = String(row[gradeKey] || '').replace(/\D/g, '');
            const cVal = String(row[classKey] || '').replace(/\D/g, '');
            const nVal = String(row[numberKey] || '').replace(/\D/g, '');
            if (gVal && cVal && nVal) {
              const formattedClass = cVal.padStart(2, '0');
              const formattedNum = nVal.padStart(2, '0');
              const calculatedId = `${gVal}${formattedClass}${formattedNum}`;
              return {
                ...row,
                [studentIdKey!]: calculatedId
              };
            }
            return row;
          });
        }

        // Find name key using standard korean keywords
        const nameKey = cleanHeaders.find(h => {
          const norm = String(h).replace(/\s+/g, '').toLowerCase();
          return norm.includes('이름') || norm.includes('성명') || norm.includes('학생명') || norm === 'name';
        });

        if (!studentIdKey || !birthdateKey) {
          setErrorMsg(
            `필수 컬럼 판단 실패: 업로드한 엑셀에 '학번' 혹은 '학년', '반', '번호' 전체와 '생년월일(8자리)'이 매핑되는 컬럼이 필요합니다.\n` +
            `감지된 헤더 속성: [${cleanHeaders.join(', ')}]`
          );
          return;
        }

        let successCount = 0;
        let skippedCount = 0;
        const updatedStudents = [...allStudents];

        for (const row of processedRows) {
          const rawId = String(row[studentIdKey]).replace(/\s+/g, '');
          const rawBirth = String(row[birthdateKey]).replace(/\s+/g, '').replace(/\D/g, '');
          const rawName = nameKey ? String(row[nameKey]).trim() : '';

          if (!rawId || !rawBirth) {
            skippedCount++;
            continue;
          }

          const formattedId = rawId.replace(/\D/g, '').trim();
          // The formatted ID should be supported if it's dynamic
          if (formattedId.length < 4) {
            skippedCount++;
            continue;
          }

          let formattedBirth = rawBirth;
          if (formattedBirth.length === 6) {
            const yearPrefix = parseInt(formattedBirth.substring(0, 2), 10) > 30 ? '19' : '20';
            formattedBirth = yearPrefix + formattedBirth;
          }

          if (formattedBirth.length !== 8) {
            skippedCount++;
            continue;
          }

          const finalName = rawName || `학생 (${formattedId})`;

          const idx = updatedStudents.findIndex(s => s.studentId === formattedId);
          const existingS = idx >= 0 ? updatedStudents[idx] : null;

          const item: RegisteredStudent = {
            studentId: formattedId,
            name: finalName,
            birthdate: formattedBirth,
            ...(existingS && existingS.password ? { password: existingS.password } : {})
          };

          if (idx >= 0) {
            updatedStudents[idx] = item;
          } else {
            updatedStudents.push(item);
          }
          successCount++;
        }

        updatedStudents.sort((a, b) => a.studentId.localeCompare(b.studentId));
        onUpdateStudents(updatedStudents);
        onSaveExcelUpload('students', file.name, successCount);

        setSuccessMsg(
          `학생 엑셀 조회 등록 완료: 총 ${successCount}명의 교적 정보가 연동되었습니다.` +
          (skippedCount > 0 ? ` (학번 5자리 성립 미달, 생년월일 표기 오차 등으로 ${skippedCount}줄 무시 처리됨)` : '')
        );
      } catch (err) {
        console.error(err);
        setErrorMsg('엑셀 파일을 구조화하여 학적 목록을 파싱하는 데 실패했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (activeTab === 'teachers') {
        processTeachersExcel(file);
      } else {
        processStudentsExcel(file);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (activeTab === 'teachers') {
        processTeachersExcel(file);
      } else {
        processStudentsExcel(file);
      }
    }
  };

  // Individual additions
  const handleAddTeacherIndividually = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanCode = newCode.replace(/\D/g, '').trim();
    const cleanName = newName.trim();
    const cleanPassword = newPassword.trim();

    if (!cleanCode) {
      setErrorMsg('교사코드를 숫자로 입력하십시오.');
      return;
    }

    let formattedCode = cleanCode;
    if (formattedCode.length > 0 && formattedCode.length < 3) {
      formattedCode = formattedCode.padStart(3, '0');
    }

    if (formattedCode.length !== 3) {
      setErrorMsg('교사코드는 3자리 숫자로 구성되어야 함 (예: 001, 002)');
      return;
    }

    if (!cleanName) {
      setErrorMsg('담당 선생님 성함을 입력하십시오.');
      return;
    }

    const updatedTeachers = [...teachers];
    const idx = updatedTeachers.findIndex(t => t.code === formattedCode);
    const existingT = idx >= 0 ? updatedTeachers[idx] : null;

    let resolvedPassword = cleanPassword;
    let newIsPasswordChanged = existingT?.isPasswordChanged || false;

    if (editingTeacherCode !== null) {
      if (existingT?.isPasswordChanged) {
        if (cleanPassword === '') {
          resolvedPassword = existingT.password || '';
        } else {
          resolvedPassword = cleanPassword;
          newIsPasswordChanged = false;
        }
      } else {
        resolvedPassword = cleanPassword || existingT?.password || '1004';
      }
    } else {
      resolvedPassword = cleanPassword || '1004';
      newIsPasswordChanged = false;
    }

    const teaData: Teacher = {
      code: formattedCode,
      name: cleanName,
      password: resolvedPassword,
      isPasswordChanged: newIsPasswordChanged
    };

    if (idx >= 0) {
      updatedTeachers[idx] = teaData;
      setSuccessMsg(`"${cleanName}" 선생님(코드: ${formattedCode})의 계정 정보가 개별 수정되었습니다.`);
    } else {
      updatedTeachers.push(teaData);
      setSuccessMsg(`"${cleanName}" 선생님(코드: ${formattedCode}) 등록이 완료되었습니다.`);
    }

    updatedTeachers.sort((a, b) => {
      const numA = parseInt(a.code, 10);
      const numB = parseInt(b.code, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.code.localeCompare(b.code);
    });
    onUpdateTeachers(updatedTeachers);

    // Reset Form Fields
    setNewCode('');
    setNewName('');
    setNewPassword('');
    setEditingTeacherCode(null);
  };

  const handleAddStudentIndividually = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanId = newStudentId.replace(/\D/g, '').trim();
    const cleanName = newStudentName.trim();
    const cleanBirth = newStudentBirthdate.replace(/\D/g, '').trim();

    if (cleanId.length !== 5) {
      setErrorMsg('학번은 5자리 숫자로 정확히 입력해 주세요. (예: 30512)');
      return;
    }

    if (!cleanName) {
      setErrorMsg('학생 성명을 입력해 주세요.');
      return;
    }

    if (cleanBirth.length !== 8) {
      setErrorMsg('생년월일은 8자리 숫자로 정확히 입력해 주세요. (예: 20080512)');
      return;
    }

    const updatedStudents = [...allStudents];
    const idx = updatedStudents.findIndex(s => s.studentId === cleanId);
    const existingS = idx >= 0 ? updatedStudents[idx] : null;

    const studentData: RegisteredStudent = {
      studentId: cleanId,
      name: cleanName,
      birthdate: cleanBirth,
      ...(existingS && existingS.password ? { password: existingS.password } : {})
    };

    if (idx >= 0) {
      updatedStudents[idx] = studentData;
      setSuccessMsg(`학번 ${cleanId} "${cleanName}" 학생의 학적 정보가 개별 수정되었습니다.`);
    } else {
      updatedStudents.push(studentData);
      setSuccessMsg(`학번 ${cleanId} "${cleanName}" 학생이 개별 등록되었습니다.`);
    }

    updatedStudents.sort((a, b) => a.studentId.localeCompare(b.studentId));
    onUpdateStudents(updatedStudents);

    // Reset Form Fields
    setNewStudentId('');
    setNewStudentName('');
    setNewStudentBirthdate('');
    setEditingStudentId(null);
  };

  // Start Edit triggers
  const handleStartEdit = (teacher: Teacher) => {
    setEditingTeacherCode(teacher.code);
    setNewCode(teacher.code);
    setNewName(teacher.name);
    setNewPassword(teacher.isPasswordChanged ? '' : (teacher.password || '1004'));
    setErrorMsg('');
    setSuccessMsg('');
    
    const formPanel = document.getElementById('individual-teacher-form');
    if (formPanel) {
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleStartEditStudent = (student: RegisteredStudent) => {
    setEditingStudentId(student.studentId);
    setNewStudentId(student.studentId);
    setNewStudentName(student.name);
    setNewStudentBirthdate(student.birthdate);
    setErrorMsg('');
    setSuccessMsg('');

    const formPanel = document.getElementById('individual-student-form');
    if (formPanel) {
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCancelEdit = () => {
    setEditingTeacherCode(null);
    setNewCode('');
    setNewName('');
    setNewPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCancelEditStudent = () => {
    setEditingStudentId(null);
    setNewStudentId('');
    setNewStudentName('');
    setNewStudentBirthdate('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleDelete = (code: string, name: string) => {
    setConfirmModal({
      title: '교사 계정 삭제 확인 ⚠️',
      message: `"${name}" 선생님(코드: ${code}) 계정을 목록에서 정말 삭제하시겠습니까?\n삭제할 경우 해당 교사로 업로드된 평가 성적도 동시 자동 소멸 삭제처리 됩니다.`,
      actionText: '계정 및 성적 삭제하기',
      onConfirm: () => {
        onDeleteTeacher(code, name);
        setSuccessMsg(`"${name}" 선생님 계정 및 등록한 수행평가가 파이어베이스에서 완전 삭제되었습니다.`);
        setConfirmModal(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleDeleteStudentRow = (studentId: string, name: string) => {
    setConfirmModal({
      title: '학생 정보 삭제 확인 ⚠️',
      message: `학번 ${studentId} "${name}" 학생의 계정 정보를 데이터베이스에서 정말로 제거하시겠습니까?`,
      actionText: '교적 정보 삭제하기',
      onConfirm: () => {
        onDeleteStudent(studentId, name);
        setSuccessMsg(`학번 ${studentId} "${name}" 학생의 교적 정보 삭제가 실시간 클라우드 DB에 동기화되었습니다.`);
        setConfirmModal(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleResetStudentPassword = (stud: RegisteredStudent) => {
    setConfirmModal({
      title: '학생 비밀번호 초기화 🔑',
      message: `학번 ${stud.studentId} "${stud.name}" 학생의 개별 설정을 제거하고 원래 생년월일(${stud.birthdate}) 입력 방식으로 로그인하도록 원복하시겠습니까?`,
      actionText: '생년월일 로그인으로 초기화',
      onConfirm: () => {
        const updatedStudents = allStudents.map(s => {
          if (s.studentId === stud.studentId) {
            const { password, isPasswordChanged, ...rest } = s;
            return rest;
          }
          return s;
        });
        const successText = `학번 ${stud.studentId} "${stud.name}" 학생의 비밀번호가 원래 생년월일(${stud.birthdate}) 로그인 방식으로 성공적으로 초기화되었습니다!`;
        setSuccessMsg(successText);
        onUpdateStudents(updatedStudents);
        setConfirmModal(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleResetTeacherPassword = (tea: Teacher) => {
    setConfirmModal({
      title: '교사 비밀번호 초기화 🔑',
      message: `"${tea.name}" 선생님(교사코드: ${tea.code})의 비밀번호를 기본 로그인 암호인 "1004" 방식으로 초기화하시겠습니까?\n(설정되어 있는 개별 비밀번호가 삭제되고 일반 초기 상태로 되돌아갑니다)`,
      actionText: '기본 암호(1004)로 초기화',
      onConfirm: () => {
        const updatedTeachers = teachers.map(t => {
          if (t.code === tea.code) {
            const { password, isPasswordChanged, ...rest } = t;
            return rest;
          }
          return t;
        });
        const successText = `"${tea.name}" 선생님의 비밀번호가 기본 암호 "1004" 로그인 방식으로 성공적으로 초기화되었습니다!`;
        setSuccessMsg(successText);
        onUpdateTeachers(updatedTeachers);
        setConfirmModal(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  // Search filter computes
  const filteredTeachers = teachers.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.code.includes(term) || t.name.toLowerCase().includes(term);
  });

  const filteredStudents = allStudents.filter(s => {
    if (!studentSearchTerm) return true;
    const term = studentSearchTerm.toLowerCase();
    return s.studentId.includes(term) || s.name.toLowerCase().includes(term) || s.birthdate.includes(term);
  });

  return (
    <div id="admin-manager-dashboard" className="max-w-5xl mx-auto space-y-6 pb-12 px-1 sm:px-4">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs px-3 py-1 rounded-full font-extrabold inline-flex items-center gap-1 mb-1.5 shadow-sm">
            🛡️ 인비고 관리자 권한
          </span>
          <h1 className="text-2.5xl font-extrabold font-sans tracking-tight text-slate-900">학교 관리자 대시보드</h1>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-red-650 bg-white hover:bg-red-50 hover:border-red-200 hover:shadow-xs transition cursor-pointer"
        >
          <LogOut size={13} /> 관리자 로그아웃
        </button>
      </div>

      {/* Tri Tab Navigation Area */}
      <div className="flex flex-wrap gap-1 border-b border-indigo-100 bg-white p-1 rounded-xl shadow-xs border">
        <button
          onClick={() => { setActiveTab('teachers'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 sm:flex-initial text-center px-6 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
            activeTab === 'teachers'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          👨‍🏫 담당 교사 계정 관리 ({teachers.length}명)
        </button>
        <button
          onClick={() => { setActiveTab('students'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 sm:flex-initial text-center px-6 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
            activeTab === 'students'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          🎓 전교생 학번/생년월일 관리 ({allStudents.length}명)
        </button>
        <button
          onClick={() => { setActiveTab('privacy'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 sm:flex-initial text-center px-6 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
            activeTab === 'privacy'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          🔒 개인정보처리방침 관리
        </button>
      </div>

      {/* Shared alerts space */}
      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-650 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold animate-pulse">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
          <span className="whitespace-pre-line">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-xl flex items-start gap-2 text-xs">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Conditional Rendering Panels based on Tab */}
      {activeTab === 'privacy' ? (
        // Privacy Policy Administration Panel
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
          <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>🔒 개인정보처리방침 설정 및 스마트 파일 관리</span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                학교 홈페이지 규정에 부합하도록 다운로드용 개인정보처리방침 공식 파일을 업로드하고, 조회 화면 하단이나 확인창에 적용합니다.
              </p>
            </div>
            <span className="hidden sm:inline-block bg-indigo-50 text-indigo-805 text-[10px] px-2.5 py-1 rounded-full font-black">
              실시간 DB 수렴
            </span>
          </div>

          {/* Section 1: PDF/Doc File Upload */}
          <div className="bg-indigo-50/10 border border-indigo-100 rounded-xl p-5 space-y-4">
            <div>
              <h4 className="text-xs font-black text-slate-800 leading-none">📂 [수정] PDF 파일 업로드 및 관리 (다운로드 공식 약관)</h4>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                학생 및 학부모가 확인 버튼을 누르고 개인정보처리방침을 다운로드받을 때 제공될 메인 PDF 또는 한글/워드 파일을 여기에 업로드하세요.
              </p>
            </div>

            {/* Drag and Drop Zone */}
            <div 
              onDragEnter={handlePrivacyDrag}
              onDragOver={handlePrivacyDrag}
              onDragLeave={handlePrivacyDrag}
              onDrop={handlePrivacyDrop}
              onClick={() => privacyFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 select-none ${
                dragPrivacyActive 
                  ? 'border-indigo-650 bg-indigo-50/40' 
                  : localPrivacyFile 
                    ? 'border-emerald-300 bg-emerald-50/10' 
                    : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/30'
              }`}
            >
              <input 
                type="file"
                ref={privacyFileInputRef}
                onChange={handlePrivacyFileChange}
                accept=".pdf,.docx,.hwp,.txt"
                className="hidden"
              />
              {localPrivacyFile ? (
                <>
                  <FileSpreadsheet className="text-emerald-505 animate-bounce" size={32} />
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800 break-all">{localPrivacyFile.fileName}</p>
                    <p className="text-[10px] text-emerald-650 font-extrabold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-md inline-block">대기열에 추가됨 (하단 저장 클릭 시 실반영)</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="text-slate-400" size={32} />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-755">여기에 PDF 파일을 드래그하고 드롭하거나 영역을 클릭하세요</p>
                    <p className="text-[10px] text-slate-400 font-semibold">지원 포맷: .pdf, .docx, .txt (최대 20MB)</p>
                  </div>
                </>
              )}
            </div>

            {/* Clear option if file exists */}
            {localPrivacyFile && (
              <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">업로드 대기:</span>
                  <span className="text-xs font-bold text-slate-700 truncate">{localPrivacyFile.fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocalPrivacyFile(null);
                    setSuccessMsg('대기 파일이 제거되었습니다. 하단 약관 변경내용 저장 버튼을 누르면 파일이 초기화됩니다.');
                    setErrorMsg('');
                  }}
                  className="text-red-650 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border border-red-100"
                >
                  <Trash2 size={12} /> 파일 삭제 (초기화)
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Text / Markdown backup box */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-slate-700">📜 개인정보처리방침 텍스트 고지문 대안 (텍스트/마크다운 형식 지원)</label>
            <textarea
              value={privacyEditorText}
              onChange={(e) => setPrivacyEditorText(e.target.value)}
              placeholder="여기에 학교 개인정보처리방침 약관 전문을 입력하세요..."
              className="w-full h-48 p-4 border border-slate-300 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 resize-none font-medium text-slate-800 select-text bg-slate-50/10"
            />
            <div className="bg-indigo-50/20 rounded-xl p-4 border border-indigo-100 flex items-start gap-2.5">
              <Info size={14} className="text-indigo-850 mt-0.5 shrink-0" />
              <div className="text-[11px] text-indigo-950/80 font-semibold leading-relaxed space-y-1">
                <p>💡 <strong className="font-extrabold text-indigo-950">텍스트 예비 안내:</strong></p>
                <p>- PDF/문서가 미지정되었거나 유실되었을 경우, 해당 입력창에 기재한 내용을 기조 문서(.txt) 형식으로 대체 다운로드해 드립니다.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 animate-fadeIn">
            <button
              type="button"
              onClick={() => {
                setPrivacyEditorText(privacyPolicy || '');
                setLocalPrivacyFile(privacyFile);
                setSuccessMsg('개인정보처리방침 설정이 마지막으로 저장된 상태로 복구되었습니다.');
                setErrorMsg('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-750 font-extrabold rounded-xl text-xs cursor-pointer transition shadow-2xs"
            >
              입력 취소 (원상복구)
            </button>
            <button
              type="button"
              disabled={isSavingPrivacy}
              onClick={async () => {
                setErrorMsg('');
                setSuccessMsg('');
                setIsSavingPrivacy(true);
                try {
                  await onUpdatePrivacyPolicy(privacyEditorText, localPrivacyFile);
                  setSuccessMsg('개인정보처리방침 공식 PDF/약관 및 문안이 실시간 데이터베이스에 완벽히 저장 및 게시되었습니다!');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } catch (err: any) {
                  setErrorMsg(`저장 실패: ${err?.message || err}`);
                } finally {
                  setIsSavingPrivacy(false);
                }
              }}
              className={`px-6 py-2.5 bg-indigo-900 border border-indigo-850 hover:bg-indigo-950 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition hover:scale-[1.01] ${
                isSavingPrivacy ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {isSavingPrivacy ? '저장하는 중...' : '💾 상위 약관 변경내용 저장'}
            </button>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Bulk Spreadsheet & Individual Registrator */}
        <div className="md:col-span-1 space-y-4">
          
          {/* Uploader Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
              <Upload size={16} className={activeTab === 'teachers' ? "text-emerald-600" : "text-sky-605"} />
              {activeTab === 'teachers' ? '교사 목록 엑셀 일괄 등록' : '전교생 학번/생년월일 일괄 등록'}
            </h3>

            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center bg-slate-50/20 py-8 ${
                dragActive 
                  ? 'border-indigo-650 bg-indigo-50/50' 
                  : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/70'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden" 
                id="excel-file-uploader-elem"
              />
              <FileSpreadsheet size={20} className="text-slate-400 mb-2 animate-bounce" />
              <p className="text-[11px] font-extrabold text-slate-700 leading-normal">
                {activeTab === 'teachers' ? '교사 목록 엑셀 드롭 또는 클릭' : '전교생 학적부 엑셀 드롭 또는 클릭'}
              </p>
              <p className="text-[9.5px] text-slate-400 mt-1.5 leading-relaxed">
                {activeTab === 'teachers' ? (
                  <>※ 칼럼에 <strong>교사코드</strong>(3자리), <strong>선생님이름</strong>,<br />그리고 선택사항인 <strong>비밀번호</strong> 필수 포함</>
                ) : (
                  <>※ 칼럼에 <strong>학번</strong>(5자리), <strong>생년월일</strong>(8자리),<br />그리고 선택사항 <strong>이름</strong> 속성이 포함될 필요</>
                )}
              </p>
            </div>

            {/* Active File Info display */}
            {(() => {
              const activeUpload = excelUploads.find(u => u.id === activeTab);
              const itemsCount = activeTab === 'teachers' ? teachers.length : allStudents.length;

              if (activeUpload) {
                return (
                  <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                    <span className="text-[10px] text-indigo-900 font-extrabold flex items-center gap-1">
                      📊 최근 연동된 교적 엑셀 파일
                    </span>
                    <p className="text-xs font-bold text-slate-800 break-all">{activeUpload.fileName}</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold pt-1">
                      <span>가져온 데이터: {activeUpload.recordCount}건</span>
                      <span>연동 일시: {new Date(activeUpload.uploadedAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}</span>
                    </div>
                  </div>
                );
              } else if (itemsCount > 0) {
                return (
                  <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                    <span className="text-[10px] text-emerald-800 font-extrabold flex items-center gap-1">
                      📊 기존 연동 데이터 감지됨
                    </span>
                    <p className="text-xs font-bold text-slate-800 font-sans">
                      {activeTab === 'teachers' 
                        ? `총 ${teachers.length}명의 교사 계정이 활성화 중` 
                        : `총 ${allStudents.length}명의 학생 교적이 활성화 중`
                      }
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold pt-0.5 leading-normal">
                      ※ 새로 엑셀(.xlsx) 파일을 업로드하시면 해당 파일명과 연동 이력이 기록됩니다.
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="p-3.5 bg-pink-50/50 border border-pink-100 rounded-xl space-y-1">
                    <span className="text-[10px] text-pink-700 font-extrabold flex items-center gap-1">
                      ⚠️ 등록된 명부 데이터 없음
                    </span>
                    <p className="text-[11px] font-bold text-pink-900">
                      {activeTab === 'teachers'
                        ? '등록된 선생님 정보가 존재하지 않습니다.'
                        : '등록된 학생 학적 정보가 존재하지 않습니다.'
                      }
                    </p>
                    <p className="text-[10px] text-pink-600 leading-normal font-medium">
                      준비한 엑셀 파일을 위 영역에 얹거나 클릭하여 업로드해 주세요!
                    </p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Individual Form */}
          {activeTab === 'teachers' ? (
            <div id="individual-teacher-form" className={`p-5 rounded-2xl border transition-all duration-300 space-y-4 shadow-sm ${
              editingTeacherCode !== null 
                ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-200/50' 
                : 'bg-white border-slate-200'
            }`}>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
                {editingTeacherCode !== null ? (
                  <>
                    <Edit size={16} className="text-amber-600 animate-pulse" />
                    <span className="text-amber-950 font-black">교사 개별 정보 수정</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} className="text-indigo-650" />
                    <span>교사 개별 등록/수정</span>
                  </>
                )}
              </h3>

              <form onSubmit={handleAddTeacherIndividually} className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-500" htmlFor="t-code">
                      교사코드 (3자리 숫자)
                    </label>
                    {editingTeacherCode !== null && (
                      <span className="text-[9px] text-amber-900 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                        수정 모드: 고정됨
                      </span>
                    )}
                  </div>
                  <input 
                    id="t-code"
                    type="text" 
                    maxLength={3}
                    placeholder="예: 001"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className={`w-full text-xs px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 font-mono ${
                      editingTeacherCode !== null
                        ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed select-none'
                        : 'border-slate-300 focus:ring-indigo-300 focus:border-indigo-500'
                    }`}
                    disabled={editingTeacherCode !== null}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1" htmlFor="t-name">
                    담당 선생님 성함
                  </label>
                  <input 
                    id="t-name"
                    type="text" 
                    placeholder="예: 이혜영"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1" htmlFor="t-password">
                    선생님 비밀번호
                  </label>
                  <input 
                    id="t-password"
                    type="text" 
                    placeholder={
                      editingTeacherCode !== null
                        ? teachers.find(t => t.code === editingTeacherCode)?.isPasswordChanged
                          ? "🔒 교사 개별 로그인용 비밀번호 유지 중 (입력시 새 비번 변경)"
                          : "미설정시 기존 초기 설정 비밀번호 유지"
                        : "미입력시 기본 비밀번호 1004"
                    }
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-500 font-mono text-slate-800"
                  />
                </div>

                <div className="pt-1.5 space-y-2">
                  <button 
                    type="submit"
                    className={`w-full py-2 text-white rounded-xl text-xs font-extrabold transition duration-150 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                      editingTeacherCode !== null
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-indigo-900 hover:bg-indigo-950'
                    }`}
                  >
                    {editingTeacherCode !== null ? (
                      <><CheckCircle2 size={13} /> 변경 내용 연동 저장</>
                    ) : (
                      <><UserPlus size={13} /> 교사 추가 등록 / 덮어쓰기</>
                    )}
                  </button>

                  {editingTeacherCode !== null && (
                    <button 
                      type="button"
                      onClick={handleCancelEdit}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      편집 취소
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <div id="individual-student-form" className={`p-5 rounded-2xl border transition-all duration-300 space-y-4 shadow-sm ${
              editingStudentId !== null 
                ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-200/50' 
                : 'bg-white border-slate-200'
            }`}>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
                {editingStudentId !== null ? (
                  <>
                    <Edit size={16} className="text-amber-600 animate-pulse" />
                    <span className="text-amber-950 font-black">학생 학적 개별 수정</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} className="text-sky-652" />
                    <span>학생 개별 등록/수정</span>
                  </>
                )}
              </h3>

              <form onSubmit={handleAddStudentIndividually} className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-500" htmlFor="s-id">
                      학번 (5자리 숫자)
                    </label>
                    {editingStudentId !== null && (
                      <span className="text-[9px] text-amber-900 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                        수정 모드: 고정됨
                      </span>
                    )}
                  </div>
                  <input 
                    id="s-id"
                    type="text" 
                    maxLength={5}
                    placeholder="예: 30512"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className={`w-full text-xs px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 font-mono ${
                      editingStudentId !== null
                        ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed select-none'
                        : 'border-slate-300 focus:ring-indigo-300 focus:border-indigo-500'
                    }`}
                    disabled={editingStudentId !== null}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1" htmlFor="s-name">
                    학생 성명
                  </label>
                  <input 
                    id="s-name"
                    type="text" 
                    placeholder="예: 홍길동"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1" htmlFor="s-birth">
                    생년월일 (8자리)
                  </label>
                  <input 
                    id="s-birth"
                    type="text" 
                    maxLength={8}
                    placeholder="예: 20080512"
                    value={newStudentBirthdate}
                    onChange={(e) => setNewStudentBirthdate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-500 font-mono"
                    required
                  />
                </div>

                <div className="pt-1.5 space-y-2">
                  <button 
                    type="submit"
                    className={`w-full py-2 text-white rounded-xl text-xs font-extrabold transition duration-150 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                      editingStudentId !== null
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-indigo-900 hover:bg-indigo-950'
                    }`}
                  >
                    {editingStudentId !== null ? (
                      <><CheckCircle2 size={13} /> 학력 정보 수정 저장</>
                    ) : (
                      <><UserPlus size={13} /> 학생 등록 / 데이터 병합</>
                    )}
                  </button>

                  {editingStudentId !== null && (
                    <button 
                      type="button"
                      onClick={handleCancelEditStudent}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      편집 취소
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          <div className="bg-indigo-50/50 border border-indigo-150/60 p-4 rounded-2xl text-[11px] text-indigo-950 space-y-1.5 shadow-2xs">
            <span className="font-bold text-indigo-900 flex items-center gap-1">
              <Info size={14} className="text-indigo-600 shrink-0" />
              실시간 클라우드 DB 연동 안내
            </span>
            <p className="leading-relaxed text-indigo-950/80">
              {activeTab === 'teachers' 
                ? '새로 등록한 선생님은 즉시 조회 메인 화면의 담당 교사 목록에 반영됩니다. 선생님용 계정 비밀번호는 개별 확인 및 수정이 상시 가능합니다.'
                : '서로 다른 엑셀 파일로 학생 학적부를 나누어 등록하셔도 학번을 Key값으로 하여 기존 자료에 안전하게 실시간 누적 병합(Upsert)됩니다.'
              }
            </p>
          </div>

        </div>

        {/* Right Side: Roster Table View with Search Bar */}
        <div className="md:col-span-2 space-y-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Users size={16} className="text-indigo-900" />
                  {activeTab === 'teachers' 
                    ? `등록 교사 현황 (${teachers.length}명)` 
                    : `전교생 학적 등록 현황 (${allStudents.length}명)`
                  }
                </h3>
                <p className="text-[11px] text-slate-400">
                  {activeTab === 'teachers' ? '교사코드 또는 이름으로 검색' : '학번, 이름 또는 생년월일 조회'}
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search size={14} />
                </span>
                <input 
                  type="text" 
                  placeholder={activeTab === 'teachers' ? "교사명 또는 코드(3자리) 검색" : "학번, 이름, 생년월일 검색..."}
                  value={activeTab === 'teachers' ? searchTerm : studentSearchTerm}
                  onChange={(e) => activeTab === 'teachers' ? setSearchTerm(e.target.value) : setStudentSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>
            </div>

            {/* Render Active Table */}
            {activeTab === 'teachers' ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-650 border-b border-slate-200 sticky top-0 font-sans z-10 text-[11px]">
                      <th className="py-2.5 px-3 font-semibold text-center w-14 border-r border-slate-200">순서</th>
                      <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-indigo-900">교사코드</th>
                      <th className="py-2.5 px-4 font-semibold border-r border-slate-200">담당 선생님 성함</th>
                      <th className="py-2.5 px-4 font-semibold border-r border-slate-200 font-sans">비밀번호 상태</th>
                      <th className="py-2.5 px-4 font-semibold text-center whitespace-nowrap min-w-[245px]">관리 작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400 italic">
                          {teachers.length === 0 
                             ? '현재 등록된 교사가 없습니다. 교사 목록 엑셀 파일(.xlsx)을 업로드해주십시오.'
                             : '검색어와 일치하는 선생님을 찾을 수 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((tea, index) => (
                        <tr key={tea.code} className={`transition-colors ${
                          editingTeacherCode === tea.code ? 'bg-amber-50 hover:bg-amber-100/80 font-medium' : 'hover:bg-slate-50/50'
                        }`}>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono border-r border-slate-200">{index + 1}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-black font-mono text-indigo-700 tracking-wider">
                            <span className="bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded text-[11px]">
                              {tea.code}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-800 text-[12px]">{tea.name} 선생님</td>
                          <td className="py-2.5 px-4 border-r border-slate-200">
                            <div className="flex items-center">
                              {tea.isPasswordChanged ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                  🔒 개별 변경함 (●●●●)
                                </span>
                              ) : tea.password && tea.password !== '1004' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-450 bg-sky-400"></span>
                                  🔑 초기 비밀번호 (●●●●)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-normal bg-slate-50 text-slate-400 border border-slate-200 shadow-2xs font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-350 bg-slate-300"></span>
                                  기본 비밀번호 (1004)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <button 
                                 type="button"
                                 onClick={() => handleStartEdit(tea)}
                                 className="p-1.5 px-2.5 border border-amber-200 text-amber-800 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-300 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-extrabold whitespace-nowrap shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Edit size={11} /> 수정
                              </button>
                              <button 
                                 type="button"
                                 onClick={() => handleResetTeacherPassword(tea)}
                                 className="p-1.5 px-2.5 border border-sky-200 text-sky-700 bg-sky-50 shadow-2xs hover:bg-sky-100 hover:border-sky-300 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-extrabold whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                                 title="이 선생님의 비밀번호를 기본 '1004'로 강제 초기화합니다."
                              >
                                <RotateCcw size={11} /> 비번초기화
                              </button>
                              <button 
                                 type="button"
                                 onClick={() => handleDelete(tea.code, tea.name)}
                                 className="p-1.5 px-2.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-250 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-extrabold whitespace-nowrap shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Trash2 size={11} /> 삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-650 border-b border-slate-200 sticky top-0 font-sans z-10 text-[11px]">
                      <th className="py-2.5 px-3 font-semibold text-center w-14 border-r border-slate-200">순서</th>
                      <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-indigo-900">학번 (ID)</th>
                      <th className="py-2.5 px-4 font-semibold border-r border-slate-200">학생 성명</th>
                      <th className="py-2.5 px-4 font-semibold border-r border-slate-200">생년월일</th>
                      <th className="py-2.5 px-4 font-semibold border-r border-slate-200">개별 설정 비밀번호</th>
                      <th className="py-2.5 px-4 font-semibold text-center whitespace-nowrap min-w-[245px]">관리 작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                          {allStudents.length === 0 
                             ? '현재 등록된 전교생 학번 명부가 없습니다. 학적부 엑셀 파일(.xlsx)을 업로드하여 일괄 연동해 주십시오.'
                             : '검색 조건에 맞는 학생 정보를 찾을 수 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((stud, index) => (
                        <tr key={stud.studentId} className={`transition-colors ${
                          editingStudentId === stud.studentId ? 'bg-amber-50 hover:bg-amber-100/80 font-medium' : 'hover:bg-slate-50/50'
                        }`}>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono border-r border-slate-200">{index + 1}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-black font-mono text-slate-800 tracking-wider">
                            <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {stud.studentId}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-indigo-950 text-[11.5px]">{stud.name}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-mono text-slate-600 font-bold text-[11.5px]">{stud.birthdate}</td>
                          <td className="py-2.5 px-4 border-r border-slate-200">
                            <div className="flex items-center">
                              {stud.isPasswordChanged ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                  🔒 개별 설정됨 (●●●●)
                                </span>
                              ) : stud.password ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                                  🔑 초기 비밀번호 (●●●●)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-normal bg-slate-50 text-slate-400 border border-slate-200 shadow-2xs font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  미설정 (생년월일 로그인)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <button 
                                 type="button"
                                 onClick={() => handleStartEditStudent(stud)}
                                 className="p-1.5 px-2.5 border border-amber-200 text-amber-800 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-300 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-extrabold whitespace-nowrap shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Edit size={11} /> 수정
                              </button>
                              <button 
                                 type="button"
                                 onClick={() => handleResetStudentPassword(stud)}
                                 className="p-1.5 px-2.5 border border-sky-200 text-sky-700 bg-sky-50 shadow-2xs hover:bg-sky-100 hover:border-sky-300 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-extrabold whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                                 title="이 학생의 비밀번호를 원래 생년월일(8자리)로 강제 초기화합니다."
                              >
                                <RotateCcw size={11} /> 비번초기화
                              </button>
                              <button 
                                 type="button"
                                 onClick={() => handleDeleteStudentRow(stud.studentId, stud.name)}
                                 className="p-1.5 px-2.5 border border-red-200 text-red-650 hover:bg-red-50 hover:border-red-250 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-extrabold whitespace-nowrap shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Trash2 size={11} /> 삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>

      </div>
      )}

      {/* Beautiful React Custom Confirmation Modal (Iframe-safe & Responsive) */}
      {confirmModal && (
        <div id="admin-confirm-popup" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden animate-scaleIn">
            <div className="bg-indigo-900 text-white px-5 py-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <span className="text-xs font-black tracking-tight">{confirmModal.title}</span>
            </div>
            
            <div className="p-5">
              <p className="text-xs text-slate-600 font-bold leading-relaxed whitespace-pre-wrap">
                {confirmModal.message}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl transition duration-150 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 border border-rose-500 text-white font-extrabold rounded-xl transition duration-150 cursor-pointer shadow-xs hover:scale-[1.02]"
              >
                {confirmModal.actionText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
