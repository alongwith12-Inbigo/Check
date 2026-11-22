/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import LoginCard from './components/LoginCard';
import ResultCard from './components/ResultCard';
import AdminDashboard from './components/AdminDashboard';
import AdminManager from './components/AdminManager';
import { EvaluationState, Teacher, StudentSession, RegisteredStudent, ExcelUpload, StudentSignature } from './types';
import { doc, onSnapshot, setDoc, getDoc, getDocs, collection, deleteDoc, deleteField, writeBatch, query, where, DocumentReference } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { findStudentIdKey, matchesStudentId, matchesBirthdate, classifyEvaluationGradeClasses, areGradeClassArraysEqual, stripSensitiveEvaluationColumns, isValidExtractedEvaluationData } from './utils';
import { 
  Smile, 
  HelpCircle, 
  Settings, 
  GraduationCap, 
  Eye, 
  ArrowLeft,
  ChevronRight,
  Info,
  AlertCircle,
  Key
} from 'lucide-react';

const DEFAULT_PRIVACY_POLICY = `**[수행평가 결과 조회 및 서명 제출 시스템 개인정보처리방침]**

본 수행평가 결과 조회 및 서명 제출 시스템(이하 '시스템')은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.

**1. 개인정보의 처리 목적**
본 시스템은 다음의 목적을 위하여 최소한의 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
- 학생의 수행평가 결과 및 피드백 개별 조회
- 수행평가 결과 확인 서명 제출 및 실시간 교사 확인 일람표 반영

**2. 처리하는 개인정보 항목**
본 시스템이 수집 및 조회, 처리하는 개인정보의 필수 항목은 다음과 같습니다.
- 필수 항목: 학번(학년, 반, 번호), 이름, 생년월일, 수행평가 영역별 취득 점수, 학생 성명 서명 데이터(이미지), 교사 피드백

**3. 개인정보의 처리 및 보유 기간**
본 시스템은 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
- 개인정보 보유 및 이용 기간: 당해 학년도 수행평가 결과 조회 및 이의 신청 완료 기간 (목적 달성 후 즉시 또는 학기말 파기)

**4. 개인정보의 파기절차 및 파기방법**
- 파기절차: 목적 달성 또는 보유기간이 만료된 데이터베이스 레코드는 관계 법령에 따라 보안상 복구 불가능한 방법으로 파기합니다.
- 파기방법: 데이터베이스에서 영구 삭제 처리합니다.

**5. 정보주체의 권리·의무 및 그 행사방법**
학생 및 법정대리인은 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있으며, 이의 신청은 각 교과 담당 선생님 및 학교 정보 담당자에게 요청하실 수 있습니다.

**6. 개인정보의 안전성 확보 조치**
본 시스템은 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
- 관리적 조치: 개인정보 취급 직원의 최소화 및 정기 교육
- 기술적 조치: 비밀번호 일방향 암호화, 데이터베이스 접근 권한 관리, 보안 전송 기능 적용

**7. 개인정보 보호책임자 및 고충처리 부서**
본 시스템의 개인정보 관련 문의 및 고충 처리는 각 학교의 담당 부서 및 교과 선생님을 통해 문의 바랍니다.

* 본 개인정보 처리방침은 학교 및 교육청 보안 지침 등에 따라 내용이 수정 및 변경될 수 있습니다.`;

function renderMarkdown(text: string) {
  return text.split('\n').map((line, idx) => {
    let cleanLine = line.trim();
    if (!cleanLine) return <div key={idx} className="h-2" />;
    
    // Check if header like **[수행평가 ... ]**
    if (cleanLine.startsWith('**') && cleanLine.endsWith('**')) {
      const content = cleanLine.slice(2, -2);
      return (
        <h3 key={idx} className="text-sm font-extrabold text-indigo-950 tracking-tight mt-4 mb-2 first:mt-0">
          {content}
        </h3>
      );
    }
    
    // Check if subheading like **1. 개인정보의 처리 목적**
    if (cleanLine.includes('**')) {
      // Split by ** to find bold inline text
      const parts = line.split('**');
      return (
        <p key={idx} className="text-xs text-slate-700 leading-relaxed font-semibold">
          {parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-slate-950">{p}</strong> : p)}
        </p>
      );
    }
    
    // Bullet item like - 필수 항목... or * 필수 항목...
    if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
      const bulletContent = line.replace(/^[-*]\s+/, '');
      const parts = bulletContent.split('**');
      return (
        <li key={idx} className="text-xs text-slate-650 leading-relaxed pl-4 -indent-4 font-semibold flex items-start gap-1">
          <span className="text-indigo-650 font-extrabold shrink-0 select-none">•</span>
          <span>{parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-slate-950">{p}</strong> : p)}</span>
        </li>
      );
    }
    
    return (
      <p key={idx} className="text-xs text-slate-650 leading-relaxed font-semibold">
        {line}
      </p>
    );
  });
}

export default function App() {
  // All evaluations in the database
  const [allEvaluations, setAllEvaluations] = useState<EvaluationState[]>([]);

  // Registered students roster managed by administration
  const [allStudents, setAllStudents] = useState<RegisteredStudent[]>([]);

  // Metadata of uploaded Excel roster files
  const [excelUploads, setExcelUploads] = useState<ExcelUpload[]>([]);

  // Subject-level final max score configurations
  const [subjectMaxScores, setSubjectMaxScores] = useState<Record<string, string>>({});

  // Subject-level final completion configurations
  const [subjectCompletionStates, setSubjectCompletionStates] = useState<Record<string, boolean>>({});

  // Selected state for student
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string>('');

  // Roster lists
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherCode, setSelectedTeacherCode] = useState('');
  const [loggedTeacher, setLoggedTeacher] = useState<Teacher | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Admin select portal inputs
  const [inputTeacherCode, setInputTeacherCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [authRole, setAuthRole] = useState<'teacher' | 'admin'>('teacher');
  const [authError, setAuthError] = useState('');

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [loggedStudent, setLoggedStudent] = useState<StudentSession | null>(null);

  // Active evaluation ID for the logged in teacher's panel
  const [activeEvaluationId, setActiveEvaluationId] = useState<string>('');

  // Teacher-level settings (e.g., signature enabled)
  const [teacherSettings, setTeacherSettings] = useState<Record<string, boolean>>({});

  // Student signatures bound to specific evaluationId + studentId
  const [signatures, setSignatures] = useState<StudentSignature[]>([]);

  const [privacyPolicy, setPrivacyPolicy] = useState<string>('');
  const [privacyFile, setPrivacyFile] = useState<{ fileName: string; fileBase64: string } | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);

  // Refs to prevent duplicate fetches across transitions
  const hasLoadedPrivacyRef = useRef<boolean>(false);
  const loadedStudentsForTeacherRef = useRef<string | null>(null);
  const pendingTeacherEvalSelectRef = useRef<string | null>(null);

  const isStudentMode = !isAdminOpen && !!loggedStudent;
  const isTeacherMode = isAdminOpen && !!loggedTeacher && !isAdminLoggedIn;
  const isAdminMode = isAdminOpen && isAdminLoggedIn;

  // Load Subject Settings on demand (only when student or teacher is logged in)
  useEffect(() => {
    if (!isStudentMode && !isTeacherMode) {
      return;
    }

    let cancelled = false;
    getDocs(collection(db, 'subjectSettings'))
      .then((snap) => {
        if (cancelled) return;
        const scores: Record<string, string> = {};
        const completions: Record<string, boolean> = {};
        snap.forEach((d) => {
          const data = d.data();
          scores[d.id] = data.maxScore !== undefined ? String(data.maxScore) : '';
          completions[d.id] = !!data.completed;
        });
        setSubjectMaxScores(scores);
        setSubjectCompletionStates(completions);
      })
      .catch((error) => {
        console.warn("Firestore subjectSettings fetch failed: ", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isStudentMode, isTeacherMode, loggedStudent?.studentId, loggedTeacher?.code]);

  // Load Teacher Settings on demand (scoped to single doc for teacher, one-time fetch for student)
  useEffect(() => {
    if (!isStudentMode && !isTeacherMode) {
      return;
    }

    let cancelled = false;
    if (isTeacherMode && loggedTeacher) {
      getDoc(doc(db, 'teacherSettings', loggedTeacher.code))
        .then((d) => {
          if (cancelled) return;
          setTeacherSettings((prev) => ({
            ...prev,
            [loggedTeacher.code]: d.exists() ? !!d.data().signatureEnabled : false,
          }));
        })
        .catch((error) => {
          console.warn("Firestore teacherSettings fetch failed: ", error);
        });
    } else if (isStudentMode) {
      getDocs(collection(db, 'teacherSettings'))
        .then((snap) => {
          if (cancelled) return;
          const settings: Record<string, boolean> = {};
          snap.forEach((d) => {
            const data = d.data();
            settings[d.id] = !!data.signatureEnabled;
          });
          setTeacherSettings(settings);
        })
        .catch((error) => {
          console.warn("Firestore teacherSettings fetch failed: ", error);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [isStudentMode, isTeacherMode, loggedStudent?.studentId, loggedTeacher?.code]);

  // Subscribe to Student Signatures in real-time ONLY for logged-in student or teacher
  useEffect(() => {
    if (!isStudentMode && !isTeacherMode) {
      setSignatures([]);
      return;
    }

    let q;
    if (isStudentMode && loggedStudent) {
      // Students only listen to their own signatures to prevent PII leakage and minimize read counts
      q = query(collection(db, 'signatures'), where('studentId', '==', loggedStudent.studentId));
    } else if (isTeacherMode && loggedTeacher) {
      // Teachers only listen to signatures for their own teacherCode
      q = query(collection(db, 'signatures'), where('teacherCode', '==', loggedTeacher.code));
    } else {
      setSignatures([]);
      return;
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const sigs: StudentSignature[] = [];
      snap.forEach((d) => {
        const data = d.data();
        sigs.push({
          id: d.id,
          evaluationId: data.evaluationId || '',
          teacherCode: data.teacherCode || '',
          subject: data.subject || '',
          studentId: data.studentId || '',
          studentName: data.studentName || '',
          signatureDataUrl: data.signatureDataUrl || '',
          signedAt: data.signedAt || '',
        });
      });
      setSignatures(sigs);
    }, (error) => {
      console.warn("Firestore signatures subscription failed: ", error);
    });

    return () => unsubscribe();
  }, [isStudentMode, isTeacherMode, loggedStudent?.studentId, loggedTeacher?.code]);

  // Load Application Level Privacy Policy Settings only when Admin panel is authenticated (or lazily on download)
  useEffect(() => {
    if (!isAdminMode || hasLoadedPrivacyRef.current) {
      return;
    }

    let cancelled = false;
    getDoc(doc(db, 'appSettings', 'privacyPolicy'))
      .then((snap) => {
        if (cancelled) return;
        hasLoadedPrivacyRef.current = true;
        if (snap.exists()) {
          const data = snap.data();
          setPrivacyPolicy(data.content || '');
          if (data.fileName && data.fileBase64) {
            setPrivacyFile({
              fileName: data.fileName,
              fileBase64: data.fileBase64
            });
          } else {
            setPrivacyFile(null);
          }
        } else {
          setPrivacyPolicy(DEFAULT_PRIVACY_POLICY);
          setPrivacyFile(null);
        }
      })
      .catch((error) => {
        console.warn("Firestore appSettings/privacyPolicy fetch failed: ", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdminMode]);

  const handleUpdatePrivacyPolicy = async (content: string, fileData?: { fileName: string; fileBase64: string } | null) => {
    const isContentSame = hasLoadedPrivacyRef.current && content === privacyPolicy;
    const isFileSame =
      fileData === undefined ||
      (fileData === null && privacyFile === null) ||
      (!!fileData &&
        !!privacyFile &&
        fileData.fileName === privacyFile.fileName &&
        fileData.fileBase64 === privacyFile.fileBase64);

    if (isContentSame && isFileSame) {
      return;
    }

    try {
      const docRef = doc(db, 'appSettings', 'privacyPolicy');
      const updatePayload: any = {
        content: content,
        updatedAt: new Date().toISOString()
      };
      if (fileData !== undefined) {
        if (fileData) {
          updatePayload.fileName = fileData.fileName;
          updatePayload.fileBase64 = fileData.fileBase64;
        } else {
          updatePayload.fileName = "";
          updatePayload.fileBase64 = "";
        }
      }
      await setDoc(docRef, updatePayload, { merge: true });
      hasLoadedPrivacyRef.current = true;
      setPrivacyPolicy(content);
      if (fileData !== undefined) {
        setPrivacyFile(fileData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appSettings/privacyPolicy');
    }
  };

  const handleDownloadPrivacyFile = async () => {
    const isConfirmed = window.confirm("'개인정보처리방침' PDF 파일을 다운 받으시겠습니까?");
    if (isConfirmed) {
      let currentPrivacyFile = privacyFile;
      if (!hasLoadedPrivacyRef.current) {
        try {
          const snap = await getDoc(doc(db, 'appSettings', 'privacyPolicy'));
          hasLoadedPrivacyRef.current = true;
          if (snap.exists()) {
            const data = snap.data();
            setPrivacyPolicy(data.content || '');
            if (data.fileName && data.fileBase64) {
              currentPrivacyFile = {
                fileName: data.fileName,
                fileBase64: data.fileBase64
              };
              setPrivacyFile(currentPrivacyFile);
            } else {
              currentPrivacyFile = null;
              setPrivacyFile(null);
            }
          } else {
            setPrivacyPolicy(DEFAULT_PRIVACY_POLICY);
            currentPrivacyFile = null;
            setPrivacyFile(null);
          }
        } catch (error) {
          console.warn("Firestore appSettings/privacyPolicy fetch failed: ", error);
        }
      }

      if (currentPrivacyFile && currentPrivacyFile.fileBase64 && currentPrivacyFile.fileName) {
        try {
          const link = document.createElement('a');
          link.href = currentPrivacyFile.fileBase64;
          link.download = currentPrivacyFile.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          console.error("Download failed:", e);
          alert("파일 다운로드에 실패했습니다.");
        }
      } else {
        // Fallback: If no custom PDF uploaded, download DEFAULT_PRIVACY_POLICY as .txt
        try {
          const rawText = DEFAULT_PRIVACY_POLICY.replace(/\*\*/g, '');
          const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = "개인정보처리방침_기본약관.txt";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("Text download failed:", e);
          alert("파일 다운로드에 실패했습니다.");
        }
      }
    }
  };

  // 1. Load Teachers directory on demand (no reads on unauthenticated student landing page)
  useEffect(() => {
    if (!isStudentMode && !isAdminOpen) {
      return;
    }

    if (isAdminMode) {
      const collRef = collection(db, 'teachers');
      const unsubscribe = onSnapshot(collRef, (snap) => {
        const list: Teacher[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            code: d.id,
            name: data.name || '',
            password: data.password || '',
            isPasswordChanged: data.isPasswordChanged || false,
          });
        });
        list.sort((a, b) => a.code.localeCompare(b.code));
        setTeachers(list);
      }, (error) => {
        console.warn("Firestore teachers subscription failed: ", error);
      });

      return () => unsubscribe();
    }

    // One-time fetch for student result screen or teacher login/dashboard
    let cancelled = false;
    getDocs(collection(db, 'teachers'))
      .then((snap) => {
        if (cancelled) return;
        const list: Teacher[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            code: d.id,
            name: data.name || '',
            password: data.password || '',
            isPasswordChanged: data.isPasswordChanged || false,
          });
        });
        list.sort((a, b) => a.code.localeCompare(b.code));
        setTeachers(list);
      })
      .catch((error) => {
        console.warn("Firestore teachers fetch failed: ", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isStudentMode, isAdminOpen, isAdminMode]);

  // 1.5. Students directory (real-time ONLY when AdminManager is open & authenticated; one-time fetch for logged-in teacher; 0 reads otherwise)
  useEffect(() => {
    if (!isAdminMode && !isTeacherMode) {
      if (!loggedTeacher && !isAdminLoggedIn) {
        loadedStudentsForTeacherRef.current = null;
        setAllStudents([]);
      }
      return;
    }

    if (isTeacherMode && loggedTeacher) {
      if (loadedStudentsForTeacherRef.current === loggedTeacher.code) {
        return;
      }
      let cancelled = false;
      // Teachers only need a one-time fetch of students to prevent excessive read operations
      getDocs(collection(db, 'students')).then((snap) => {
        if (cancelled) return;
        const list: RegisteredStudent[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            studentId: d.id,
            name: data.name || '',
            birthdate: data.birthdate || '',
            password: data.password || '',
            isPasswordChanged: data.isPasswordChanged || false,
          });
        });
        list.sort((a, b) => a.studentId.localeCompare(b.studentId));
        loadedStudentsForTeacherRef.current = loggedTeacher.code;
        setAllStudents(list);
      }).catch((err) => {
        console.warn("One-time students fetch failed: ", err);
      });
      return () => {
        cancelled = true;
      };
    }

    // Authenticated AdminManager only
    loadedStudentsForTeacherRef.current = null;
    const collRef = collection(db, 'students');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const list: RegisteredStudent[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          studentId: d.id,
          name: data.name || '',
          birthdate: data.birthdate || '',
          password: data.password || '',
          isPasswordChanged: data.isPasswordChanged || false,
        });
      });
      list.sort((a, b) => a.studentId.localeCompare(b.studentId));
      setAllStudents(list);
    }, (error) => {
      console.warn("Firestore students subscription failed: ", error);
    });

    return () => unsubscribe();
  }, [isAdminMode, isTeacherMode, loggedTeacher?.code, isAdminLoggedIn]);

  // 1.6. Load Excel Uploads metadata once when AdminManager is open & authenticated
  useEffect(() => {
    if (!isAdminMode) {
      setExcelUploads([]);
      return;
    }
    let cancelled = false;
    getDocs(collection(db, 'excelUploads'))
      .then((snap) => {
        if (cancelled) return;
        const list: ExcelUpload[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            fileName: data.fileName || '',
            uploadedAt: data.uploadedAt || '',
            recordCount: data.recordCount || 0
          });
        });
        setExcelUploads(list);
      })
      .catch((error) => {
        console.warn("Firestore excelUploads fetch failed: ", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdminMode]);

  // 2. Load Evaluations on demand (0 reads before login or in AdminManager; scoped to teacherCode for teacher; one-time fetch for logged-in student)
  useEffect(() => {
    if (isStudentMode && loggedStudent) {
      let cancelled = false;
      getDocs(collection(db, 'evaluation'))
        .then((snap) => {
          if (cancelled) return;
          const list: EvaluationState[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              teacherCode: data.teacherCode || '',
              title: data.title || '',
              subject: data.subject || '',
              round: data.round || '',
              evaluationDetailName: data.evaluationDetailName || '',
              maxScore: data.maxScore !== undefined ? String(data.maxScore) : '',
              reflectRate: data.reflectRate !== undefined ? String(data.reflectRate) : '100',
              headers: data.headers || [],
              rows: data.rows || [],
              uploadedAt: data.uploadedAt || null,
              uploadType: data.uploadType || 'excel',
              pdfBase64: data.pdfBase64 || '',
              pdfFileName: data.pdfFileName || '',
              targetGradeClass: data.targetGradeClass || '',
              targetGradeClasses: Array.isArray(data.targetGradeClasses) ? data.targetGradeClasses.map((v: any) => String(v)) : undefined,
            });
          });
          setAllEvaluations(list);
        })
        .catch((error) => {
          console.warn("Firestore evaluations fetch failed: ", error);
        });
      return () => {
        cancelled = true;
      };
    }

    if (isTeacherMode && loggedTeacher) {
      const q = query(collection(db, 'evaluation'), where('teacherCode', '==', loggedTeacher.code));
      const unsubscribe = onSnapshot(q, (snap) => {
        const list: EvaluationState[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            teacherCode: data.teacherCode || '',
            title: data.title || '',
            subject: data.subject || '',
            round: data.round || '',
            evaluationDetailName: data.evaluationDetailName || '',
            maxScore: data.maxScore !== undefined ? String(data.maxScore) : '',
            reflectRate: data.reflectRate !== undefined ? String(data.reflectRate) : '100',
            headers: data.headers || [],
            rows: data.rows || [],
            uploadedAt: data.uploadedAt || null,
            uploadType: data.uploadType || 'excel',
            pdfBase64: data.pdfBase64 || '',
            pdfFileName: data.pdfFileName || '',
            targetGradeClass: data.targetGradeClass || '',
            targetGradeClasses: Array.isArray(data.targetGradeClasses) ? data.targetGradeClasses.map((v: any) => String(v)) : undefined,
          });
        });
        setAllEvaluations(list);
        if (pendingTeacherEvalSelectRef.current === loggedTeacher.code) {
          pendingTeacherEvalSelectRef.current = null;
          setActiveEvaluationId(list[0]?.id || '');
        }
      }, (error) => {
        console.warn("Firestore teacher evaluations subscription failed: ", error);
      });

      return () => unsubscribe();
    }

    setAllEvaluations([]);
  }, [isStudentMode, isTeacherMode, loggedStudent?.studentId, loggedTeacher?.code]);

  // Sync student's selectedTeacherCode to first teacher when list updates
  useEffect(() => {
    if (teachers.length > 0) {
      if (!teachers.some(t => t.code === selectedTeacherCode)) {
        setSelectedTeacherCode(teachers[0].code);
      }
    } else {
      setSelectedTeacherCode('');
    }
  }, [teachers, selectedTeacherCode]);

  // Filter evaluations for the selected teacher (Student view)
  const studentTeacherEvaluations = allEvaluations.filter(e => e.teacherCode === selectedTeacherCode);

  // Sync selectedEvaluationId when student selects a teacher or list updates
  useEffect(() => {
    if (studentTeacherEvaluations.length > 0) {
      if (!studentTeacherEvaluations.some(e => e.id === selectedEvaluationId)) {
        setSelectedEvaluationId(studentTeacherEvaluations[0].id || '');
      }
    } else {
      setSelectedEvaluationId('');
    }
  }, [selectedTeacherCode, allEvaluations, selectedEvaluationId]);

  // Current active evaluation state for student matching
  const currentStudentEvaluation = studentTeacherEvaluations.find(e => e.id === selectedEvaluationId) || {
    title: '수행평가 결과',
    subject: '',
    round: '',
    evaluationDetailName: '',
    headers: [],
    rows: [],
    uploadedAt: null,
    teacherCode: ''
  };

  // Filter evaluations for current teacher (Teacher dashboard view)
  const myEvaluations = allEvaluations.filter(e => e.teacherCode === loggedTeacher?.code);

  // Sync activeEvaluationId in teacher's panel
  useEffect(() => {
    if (activeEvaluationId !== '') {
      if (!myEvaluations.some(e => e.id === activeEvaluationId)) {
        setActiveEvaluationId(myEvaluations[0]?.id || '');
      }
    }
  }, [myEvaluations, activeEvaluationId]);

  // Core database modifiers passed down to teacher panels
  const handleCreateEvaluation = async (newState: EvaluationState): Promise<string> => {
    const newDocId = `${loggedTeacher?.code || 'temp'}_${Date.now()}`;
    const { targetGradeClasses: providedTargetClasses, ...restState } = newState;
    const sanitized = stripSensitiveEvaluationColumns(restState.headers || [], restState.rows || []);
    const sanitizedState: EvaluationState = {
      ...newState,
      headers: sanitized.headers,
      rows: sanitized.rows,
    };
    const classification = classifyEvaluationGradeClasses(sanitizedState);
    const resolvedTargetGradeClasses =
      Array.isArray(providedTargetClasses) && providedTargetClasses.length > 0
        ? providedTargetClasses
        : classification.status === 'exact'
          ? classification.targetGradeClasses
          : undefined;

    try {
      const docRef = doc(db, 'evaluation', newDocId);
      const payload: Record<string, any> = {
        ...restState,
        headers: sanitized.headers,
        rows: sanitized.rows,
        id: newDocId,
        teacherCode: loggedTeacher?.code || '',
      };
      if (resolvedTargetGradeClasses && resolvedTargetGradeClasses.length > 0) {
        payload.targetGradeClasses = resolvedTargetGradeClasses;
      }
      if (payload.uploadType === 'pdf') {
        if (
          payload.pdfBase64 &&
          !isValidExtractedEvaluationData(sanitized.headers, sanitized.rows)
        ) {
          throw new Error('PDF 성적 데이터 추출에 실패하여 개인정보 보호를 위해 업로드를 중단했습니다. 다시 업로드해 주세요.');
        }
        delete payload.pdfBase64;
      }
      await setDoc(docRef, payload);
      return newDocId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `evaluation/${newDocId}`);
      throw err;
    }
  };

  const handleUpdateEvaluation = async (id: string, newState: EvaluationState) => {
    const existing = allEvaluations.find((e) => e.id === id);
    const { targetGradeClasses: providedTargetClasses, ...restState } = newState;
    const classification = classifyEvaluationGradeClasses(newState);

    let resolvedTargetGradeClasses: string[] | undefined;
    if (classification.status === 'exact') {
      resolvedTargetGradeClasses = classification.targetGradeClasses;
    } else if (
      Array.isArray(providedTargetClasses) &&
      providedTargetClasses.length > 0
    ) {
      resolvedTargetGradeClasses = providedTargetClasses;
    } else if (
      existing &&
      Array.isArray(existing.targetGradeClasses) &&
      existing.targetGradeClasses.length > 0 &&
      (existing.targetGradeClass || '') === (newState.targetGradeClass || '') &&
      existing.rows === newState.rows
    ) {
      resolvedTargetGradeClasses = existing.targetGradeClasses;
    } else {
      resolvedTargetGradeClasses = undefined;
    }

    if (existing) {
      const isSame =
        (existing.title || '') === (newState.title || '') &&
        (existing.subject || '') === (newState.subject || '') &&
        (existing.round || '') === (newState.round || '') &&
        (existing.evaluationDetailName || '') === (newState.evaluationDetailName || '') &&
        (existing.maxScore || '') === (newState.maxScore || '') &&
        (existing.reflectRate || '') === (newState.reflectRate || '') &&
        (existing.targetGradeClass || '') === (newState.targetGradeClass || '') &&
        (existing.uploadType || 'excel') === (newState.uploadType || 'excel') &&
        (existing.pdfBase64 || '') === (newState.pdfBase64 || '') &&
        (existing.pdfFileName || '') === (newState.pdfFileName || '') &&
        existing.headers === newState.headers &&
        existing.rows === newState.rows &&
        areGradeClassArraysEqual(existing.targetGradeClasses, resolvedTargetGradeClasses);
      if (isSame) return;
    }

    try {
      const docRef = doc(db, 'evaluation', id);
      const payload: Record<string, any> = {
        ...restState,
        id: id,
        teacherCode: loggedTeacher?.code || '',
      };
      if (resolvedTargetGradeClasses && resolvedTargetGradeClasses.length > 0) {
        payload.targetGradeClasses = resolvedTargetGradeClasses;
      } else if (existing && Array.isArray(existing.targetGradeClasses)) {
        payload.targetGradeClasses = deleteField();
      }
      await setDoc(docRef, payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `evaluation/${id}`);
    }
  };

  const handleUpdateSubjectMaxScore = async (subject: string, maxScore: string) => {
    if (!loggedTeacher) return;
    const cleanTeacherCode = loggedTeacher.code.trim();
    const cleanSubject = subject.trim();
    const cleanMaxScore = maxScore.trim();
    const settingId = `${cleanTeacherCode}_${cleanSubject}`;

    if ((subjectMaxScores[settingId] ?? '') === cleanMaxScore) {
      return;
    }

    // Optimistically update the state immediately for seamless UX
    setSubjectMaxScores(prev => ({
      ...prev,
      [settingId]: cleanMaxScore
    }));

    try {
      const docRef = doc(db, 'subjectSettings', settingId);
      await setDoc(docRef, {
        teacherCode: cleanTeacherCode,
        subject: cleanSubject,
        maxScore: cleanMaxScore
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `subjectSettings/${settingId}`);
    }
  };

  const handleUpdateSubjectCompletion = async (subject: string, completed: boolean) => {
    if (!loggedTeacher) return;
    const cleanTeacherCode = loggedTeacher.code.trim();
    const cleanSubject = subject.trim();
    const settingId = `${cleanTeacherCode}_${cleanSubject}`;

    if ((!!subjectCompletionStates[settingId]) === completed) {
      return;
    }

    // Optimistically update the state for flawless dynamic responsiveness
    setSubjectCompletionStates(prev => ({
      ...prev,
      [settingId]: completed
    }));

    try {
      const docRef = doc(db, 'subjectSettings', settingId);
      await setDoc(docRef, {
        teacherCode: cleanTeacherCode,
        subject: cleanSubject,
        completed: completed
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `subjectSettings/${settingId}`);
    }
  };

  const handleToggleSignature = async (enabled: boolean) => {
    if (!loggedTeacher) return;
    const cleanTeacherCode = loggedTeacher.code.trim();

    if ((!!teacherSettings[cleanTeacherCode]) === enabled) {
      return;
    }

    setTeacherSettings(prev => ({
      ...prev,
      [cleanTeacherCode]: enabled
    }));

    try {
      const docRef = doc(db, 'teacherSettings', cleanTeacherCode);
      await setDoc(docRef, {
        teacherCode: cleanTeacherCode,
        signatureEnabled: enabled
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `teacherSettings/${cleanTeacherCode}`);
    }
  };

  const handleSaveSignature = async (
    evaluationId: string,
    subject: string,
    studentId: string,
    studentName: string,
    signatureDataUrl: string,
    teacherCode?: string
  ) => {
    const tCode = teacherCode || loggedStudent?.teacherCode || selectedTeacherCode || '';
    if (!tCode || !evaluationId) return;
    const cleanEvaluationId = evaluationId.trim();
    const cleanTeacherCode = tCode.trim();
    const cleanSubject = subject.replace(/\s+/g, '');
    const cleanStudentId = studentId.trim();
    const cleanStudentName = studentName.trim();
    const signatureId = `${cleanEvaluationId}_${cleanStudentId}`;

    const alreadyIdentical = signatures.some(
      (sig) =>
        sig.evaluationId === cleanEvaluationId &&
        sig.studentId === cleanStudentId &&
        sig.studentName === cleanStudentName &&
        sig.signatureDataUrl === signatureDataUrl
    );
    if (alreadyIdentical) return;

    try {
      const docRef = doc(db, 'signatures', signatureId);
      await setDoc(docRef, {
        evaluationId: cleanEvaluationId,
        teacherCode: cleanTeacherCode,
        subject: cleanSubject,
        studentId: cleanStudentId,
        studentName: cleanStudentName,
        signatureDataUrl,
        signedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `signatures/${signatureId}`);
    }
  };

  const handleDeleteSignature = async (evaluationId: string, studentId: string) => {
    if (!evaluationId || !studentId) return;
    const cleanEvaluationId = evaluationId.trim();
    const cleanStudentId = studentId.trim();
    const signatureId = `${cleanEvaluationId}_${cleanStudentId}`;

    try {
      const refsToDelete = new Map<string, DocumentReference>();
      const primaryRef = doc(db, 'signatures', signatureId);
      refsToDelete.set(primaryRef.path, primaryRef);

      signatures.forEach((sig) => {
        if (sig.evaluationId === cleanEvaluationId && matchesStudentId(sig.studentId, cleanStudentId)) {
          const ref = doc(db, 'signatures', sig.id);
          refsToDelete.set(ref.path, ref);
        }
      });

      const batch = writeBatch(db);
      refsToDelete.forEach((ref) => batch.delete(ref));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `signatures/${signatureId}`);
    }
  };

  const handleDeleteEvaluation = async (id: string) => {
    try {
      const targetEval = allEvaluations.find(e => e.id === id);
      const refsToDelete = new Map<string, DocumentReference>();

      // 1. Delete all signatures linked to this evaluationId
      const sigQuery = query(collection(db, 'signatures'), where('evaluationId', '==', id));
      const sigSnap = await getDocs(sigQuery);
      sigSnap.forEach((d) => {
        refsToDelete.set(d.ref.path, d.ref);
      });

      // 2. Clean up any legacy signatures (saved without evaluationId) belonging to this signable evaluation
      if (
        targetEval?.teacherCode &&
        (targetEval.uploadType === 'pdf' || targetEval.uploadType === 'test_excel_sign')
      ) {
        const cleanTeacherCode = targetEval.teacherCode.trim();
        const cleanSubject = (targetEval.subject || '').replace(/\s+/g, '');
        const legacyQuery = query(
          collection(db, 'signatures'),
          where('teacherCode', '==', cleanTeacherCode)
        );
        const legacySnap = await getDocs(legacyQuery);

        const otherSignableExists = allEvaluations.some(
          e =>
            e.id !== id &&
            e.teacherCode?.trim() === cleanTeacherCode &&
            (e.subject || '').replace(/\s+/g, '') === cleanSubject &&
            (e.uploadType === 'pdf' || e.uploadType === 'test_excel_sign')
        );

        const sIdKey = findStudentIdKey(targetEval.headers || []);
        legacySnap.forEach((d) => {
          const data = d.data();
          if (data.evaluationId) return;
          const sigSubject = String(data.subject || '').replace(/\s+/g, '');
          if (sigSubject !== cleanSubject) return;

          if (!otherSignableExists) {
            refsToDelete.set(d.ref.path, d.ref);
          } else if (sIdKey && targetEval.rows && targetEval.rows.length > 0) {
            const sigStudentId = String(data.studentId || '').trim();
            const inThisEval = targetEval.rows.some(row =>
              matchesStudentId(sigStudentId, row[sIdKey], targetEval.targetGradeClass)
            );
            if (inThisEval) {
              refsToDelete.set(d.ref.path, d.ref);
            }
          }
        });
      }

      // 3. Delete evaluation document + all associated signature documents in batches
      const evalDocRef = doc(db, 'evaluation', id);
      refsToDelete.set(evalDocRef.path, evalDocRef);

      const allRefs = Array.from(refsToDelete.values());
      const BATCH_LIMIT = 450;
      for (let i = 0; i < allRefs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = allRefs.slice(i, i + BATCH_LIMIT);
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      if (activeEvaluationId === id) {
        setActiveEvaluationId('');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `evaluation/${id}`);
    }
  };

  // Bulk update teachers roster (Admin view)
  const handleUpdateTeachers = async (newTeachers: Teacher[]) => {
    const changed = newTeachers.filter(nt => {
      const old = teachers.find(ot => ot.code === nt.code);
      if (!old) return true;
      const oldPassword = old.password || '';
      const ntPassword = nt.password || '';
      const oldChanged = !!old.isPasswordChanged;
      const ntChanged = !!nt.isPasswordChanged;
      return old.name !== nt.name || oldPassword !== ntPassword || oldChanged !== ntChanged;
    });

    setTeachers(newTeachers);

    if (changed.length === 0) return;

    try {
      const BATCH_LIMIT = 450;
      for (let i = 0; i < changed.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = changed.slice(i, i + BATCH_LIMIT);
        for (const t of chunk) {
          const docRef = doc(db, 'teachers', t.code);
          const payload: any = {
            code: t.code,
            name: t.name,
            isPasswordChanged: !!t.isPasswordChanged
          };
          if (t.password) {
            payload.password = t.password;
          } else {
            payload.password = deleteField();
          }
          batch.set(docRef, payload, { merge: true });
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teachers');
    }
  };

  const handleDeleteTeacher = async (code: string, name: string) => {
    const updated = teachers.filter(t => t.code !== code);
    setTeachers(updated);
    
    try {
      const refsToDelete: DocumentReference[] = [doc(db, 'teachers', code)];

      // Delete all evaluations owned by this teacher (on-demand query)
      const evalSnap = await getDocs(query(collection(db, 'evaluation'), where('teacherCode', '==', code)));
      evalSnap.forEach((d) => {
        refsToDelete.push(d.ref);
      });

      // Delete all signatures owned by this teacher
      const sigSnap = await getDocs(query(collection(db, 'signatures'), where('teacherCode', '==', code)));
      sigSnap.forEach((d) => {
        refsToDelete.push(d.ref);
      });

      const BATCH_LIMIT = 450;
      for (let i = 0; i < refsToDelete.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        refsToDelete.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teachers/${code}`);
    }

    if (selectedTeacherCode === code) {
      const fallbackCode = updated[0]?.code || '';
      setSelectedTeacherCode(fallbackCode);
    }
    if (loggedTeacher?.code === code) {
      setLoggedTeacher(null);
    }
  };

  // Bulk update student roster (Admin view)
  const handleUpdateStudents = async (newStudents: RegisteredStudent[]) => {
    const changed = newStudents.filter(ns => {
      const old = allStudents.find(os => os.studentId === ns.studentId);
      if (!old) return true;
      const oldPassword = old.password || '';
      const nsPassword = ns.password || '';
      const oldChanged = !!old.isPasswordChanged;
      const nsChanged = !!ns.isPasswordChanged;
      return old.name !== ns.name || old.birthdate !== ns.birthdate || oldPassword !== nsPassword || oldChanged !== nsChanged;
    });

    setAllStudents(newStudents);

    if (changed.length === 0) return;

    try {
      const BATCH_LIMIT = 450;
      for (let i = 0; i < changed.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = changed.slice(i, i + BATCH_LIMIT);
        for (const s of chunk) {
          const docRef = doc(db, 'students', s.studentId);
          const payload: any = {
            studentId: s.studentId,
            name: s.name,
            birthdate: s.birthdate
          };
          if (s.password) {
            payload.password = s.password;
          } else {
            payload.password = deleteField();
          }
          if (s.isPasswordChanged) {
            payload.isPasswordChanged = true;
          } else {
            payload.isPasswordChanged = deleteField();
          }
          batch.set(docRef, payload, { merge: true });
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  };

  const handleDeleteStudent = async (studentId: string, name: string) => {
    setAllStudents(prev => prev.filter(s => s.studentId !== studentId));
    try {
      const refsToDelete: DocumentReference[] = [doc(db, 'students', studentId)];
      const sigSnap = await getDocs(query(collection(db, 'signatures'), where('studentId', '==', studentId)));
      sigSnap.forEach((d) => {
        refsToDelete.push(d.ref);
      });

      const BATCH_LIMIT = 450;
      for (let i = 0; i < refsToDelete.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        refsToDelete.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
    }
  };

  const handleToggleAdmin = () => {
    setIsAdminOpen(!isAdminOpen);
    setLoggedStudent(null);
  };

  const handleValidateStudent = async (studentId: string, birthdateOrPassword: string): Promise<{ success: boolean; error?: string; session?: StudentSession }> => {
    const trimmedId = studentId.trim();
    const trimmedBirthOrPass = birthdateOrPassword.trim();

    if (!trimmedId) {
      return {
        success: false,
        error: '학번을 입력해 주세요.'
      };
    }

    try {
      // Only allow students registered in the 'students' master roster
      const studentDocRef = doc(db, 'students', trimmedId);
      const studentDocSnap = await getDoc(studentDocRef);

      if (!studentDocSnap.exists()) {
        return {
          success: false,
          error: '입력하신 학번의 학생 정보를 찾을 수 없습니다.\n문제 발생 시 학급 정보도우미를 통해 문의해주세요.'
        };
      }

      const studentData = studentDocSnap.data();
      const hasCustomPassword = studentData.password && studentData.password.trim() !== '';

      if (hasCustomPassword) {
        if (studentData.password === trimmedBirthOrPass) {
          return {
            success: true,
            session: {
              studentId: trimmedId,
              birthdate: studentData.birthdate || '',
              studentName: studentData.name || '',
              teacherName: '',
              results: [],
              teacherCode: ''
            }
          };
        } else {
          return {
            success: false,
            error: '비밀번호가 일치하지 않습니다. 비밀번호를 분실한 경우 학급 정보도우미를 통해 문의해주세요.'
          };
        }
      } else {
        if (matchesBirthdate(trimmedBirthOrPass, studentData.birthdate || '')) {
          return {
            success: true,
            session: {
              studentId: trimmedId,
              birthdate: studentData.birthdate || '',
              studentName: studentData.name || '',
              teacherName: '',
              results: [],
              teacherCode: ''
            }
          };
        } else {
          return {
            success: false,
            error: '입력하신 학번과 생년월일이 일치하는 학생 정보를 찾을 수 없습니다.\n문제 발생 시 학급 정보도우미를 통해 문의해주세요.'
          };
        }
      }
    } catch (error) {
      console.error("Student roster login check failed:", error);
      return {
        success: false,
        error: '서버 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      };
    }
  };

  const handleStudentLogin = (sessionData: StudentSession) => {
    setLoggedStudent(sessionData);
  };

  const handleStudentLogout = () => {
    setLoggedStudent(null);
    setAllEvaluations([]);
  };

  // Staff/Teacher and Admin Login Auth Check
  const handlePortalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authRole === 'admin') {
      if (inputPassword === '1004') {
        setIsAdminLoggedIn(true);
        setAuthError('');
        setInputPassword('');
      } else {
        setAuthError('관리자 비밀번호가 일치하지 않습니다. 암호를 확인해 주세요.');
      }
    } else {
      const trimmedCode = inputTeacherCode.trim();
      if (!trimmedCode) {
        setAuthError('로그인할 선생님을 선택해 주세요.');
        return;
      }
      if (!inputPassword.trim()) {
        setAuthError('선생님 암호를 기입해 주세요.');
        return;
      }

      const matchedTeacher = teachers.find(t => t.code === trimmedCode);
      if (!matchedTeacher) {
        setAuthError('등록되지 않은 선생님 정보입니다.');
        return;
      }

      const expectedPassword = (matchedTeacher.password || '').trim() || '1004';
      if (inputPassword.trim() !== expectedPassword) {
        setAuthError('선생님 비밀번호가 일치하지 않습니다.');
        return;
      }

      pendingTeacherEvalSelectRef.current = matchedTeacher.code;
      setActiveEvaluationId('');
      setLoggedTeacher(matchedTeacher);

      setAuthError('');
      setInputTeacherCode('');
      setInputPassword('');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setAllStudents([]);
    setExcelUploads([]);
  };

  const handleSaveExcelUpload = async (id: string, fileName: string, recordCount: number) => {
    try {
      const uploadedAt = new Date().toISOString();
      const docRef = doc(db, 'excelUploads', id);
      await setDoc(docRef, {
        id,
        fileName,
        uploadedAt,
        recordCount
      });
      setExcelUploads((prev) => {
        const next = prev.filter((item) => item.id !== id);
        next.push({ id, fileName, uploadedAt, recordCount });
        return next;
      });
    } catch (error) {
      console.error("Failed to save excel upload metadata:", error);
    }
  };

  const handleTeacherLogout = () => {
    pendingTeacherEvalSelectRef.current = null;
    loadedStudentsForTeacherRef.current = null;
    setLoggedTeacher(null);
    setActiveEvaluationId('');
    setAllEvaluations([]);
    setAllStudents([]);
  };

  const handleTeacherPasswordUpdated = (newPassword: string) => {
    if (!loggedTeacher) return;
    const code = loggedTeacher.code;
    setLoggedTeacher((prev) => (prev ? { ...prev, password: newPassword, isPasswordChanged: true } : prev));
    setTeachers((prev) =>
      prev.map((t) => (t.code === code ? { ...t, password: newPassword, isPasswordChanged: true } : t))
    );
  };

  // Phase 2-A: One-time on-demand evaluation fetch for Admin Migration Preview (zero listeners)
  const handleFetchEvaluationsForMigrationPreview = async (): Promise<EvaluationState[]> => {
    try {
      const snap = await getDocs(collection(db, 'evaluation'));
      const list: EvaluationState[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          teacherCode: data.teacherCode || '',
          title: data.title || '',
          subject: data.subject || '',
          round: data.round || '',
          evaluationDetailName: data.evaluationDetailName || '',
          maxScore: data.maxScore !== undefined ? String(data.maxScore) : '',
          reflectRate: data.reflectRate !== undefined ? String(data.reflectRate) : '100',
          headers: data.headers || [],
          rows: data.rows || [],
          uploadedAt: data.uploadedAt || null,
          uploadType: data.uploadType || 'excel',
          pdfBase64: data.pdfBase64 || '',
          pdfFileName: data.pdfFileName || '',
          targetGradeClass: data.targetGradeClass || '',
          targetGradeClasses: Array.isArray(data.targetGradeClasses)
            ? data.targetGradeClasses.map((v: any) => String(v))
            : undefined,
        });
      });
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'evaluation');
      throw err;
    }
  };

  // Phase 2-A: Safe partial merge-only batch migration for admin-confirmed documents
  const handleApplyEvaluationMigration = async (
    updates: { id: string; targetGradeClasses: string[]; existingTargetGradeClasses?: string[] }[]
  ): Promise<{ writtenCount: number; skippedCount: number }> => {
    const toWrite = updates.filter(
      (item) =>
        item.id &&
        Array.isArray(item.targetGradeClasses) &&
        item.targetGradeClasses.length > 0 &&
        !areGradeClassArraysEqual(item.existingTargetGradeClasses, item.targetGradeClasses)
    );
    const skippedCount = updates.length - toWrite.length;

    if (toWrite.length === 0) {
      return { writtenCount: 0, skippedCount };
    }

    try {
      const BATCH_LIMIT = 450;
      for (let i = 0; i < toWrite.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = toWrite.slice(i, i + BATCH_LIMIT);
        chunk.forEach((item) => {
          const docRef = doc(db, 'evaluation', item.id);
          batch.set(
            docRef,
            { targetGradeClasses: item.targetGradeClasses },
            { merge: true }
          );
        });
        await batch.commit();
      }
      return { writtenCount: toWrite.length, skippedCount };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'evaluation');
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none print:bg-white text-slate-800">
      
      {/* Universal Sticky Header Navigation */}
      <Navbar 
        isAdminOpen={isAdminOpen} 
        onToggleAdmin={handleToggleAdmin} 
        evaluationTitle={
          loggedTeacher 
            ? `${loggedTeacher.name} 선생님의 과목` 
            : loggedStudent
              ? `${loggedStudent.studentName} 학생의 성적표`
              : '수행평가 결과 조회'
        } 
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {isAdminOpen ? (
            isAdminLoggedIn ? (
              // Mode 1A: Admin Roster Panel
              <motion.div
                key="admin-manager-screen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <AdminManager 
                  teachers={teachers}
                  onUpdateTeachers={handleUpdateTeachers}
                  onDeleteTeacher={handleDeleteTeacher}
                  onLogout={handleAdminLogout}
                  allStudents={allStudents}
                  onUpdateStudents={handleUpdateStudents}
                  onDeleteStudent={handleDeleteStudent}
                  excelUploads={excelUploads}
                  onSaveExcelUpload={handleSaveExcelUpload}
                  privacyPolicy={privacyPolicy}
                  privacyFile={privacyFile}
                  onUpdatePrivacyPolicy={handleUpdatePrivacyPolicy}
                  onFetchEvaluationsForMigrationPreview={handleFetchEvaluationsForMigrationPreview}
                  onApplyEvaluationMigration={handleApplyEvaluationMigration}
                />
              </motion.div>
            ) : loggedTeacher ? (
              // Mode 1B: Teacher evaluations publisher dashboard
              <motion.div
                key="teacher-dashboard-screen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <AdminDashboard 
                  myEvaluations={myEvaluations}
                  activeEvaluationId={activeEvaluationId}
                  onSelectEvaluationId={setActiveEvaluationId}
                  onCreateEvaluation={handleCreateEvaluation}
                  onUpdateEvaluation={handleUpdateEvaluation}
                  onDeleteEvaluation={handleDeleteEvaluation}
                  onClose={() => setIsAdminOpen(false)}
                  loggedTeacher={loggedTeacher}
                  onLogout={handleTeacherLogout}
                  subjectMaxScores={subjectMaxScores}
                  onUpdateSubjectMaxScore={handleUpdateSubjectMaxScore}
                  subjectCompletionStates={subjectCompletionStates}
                  onUpdateSubjectCompletion={handleUpdateSubjectCompletion}
                  teacherSettings={teacherSettings}
                  signatures={signatures}
                  onToggleSignature={handleToggleSignature}
                  allStudents={allStudents}
                  onTeacherPasswordUpdated={handleTeacherPasswordUpdated}
                />
              </motion.div>
            ) : (
              // Mode 1C: Auth lock select screen for Staffs
              <motion.div
                key="portal-auth-card"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center min-h-[70vh] px-2"
              >
                <div id="general-portal-auth" className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                  <div className="bg-indigo-900 border-b border-indigo-850 text-white p-6 sm:p-7 text-center relative">
                    <div className="absolute top-0 right-0 p-3 opacity-5">
                      <Key size={80} />
                    </div>
                    <div className="inline-flex p-3 bg-white/10 rounded-full mb-2.5 text-amber-400 border border-white/10">
                      <Key size={24} className="stroke-[2.5]" />
                    </div>
                    <h2 className="text-xl font-extrabold font-sans tracking-tight">선생님/관리자 로그인</h2>
                    <p className="text-xs text-indigo-200 mt-1">선생님 또는 관리자를 선택해서 로그인해주세요.</p>
                  </div>

                  <div className="p-6 sm:p-8 space-y-5">
                    {/* Role selector tabs */}
                    <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => { setAuthRole('teacher'); setAuthError(''); }}
                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          authRole === 'teacher' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        👨‍🏫 선생님 로그인
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthRole('admin'); setAuthError(''); }}
                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          authRole === 'admin' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        🛡️ 학교 관리자 로그인
                      </button>
                    </div>

                    <form onSubmit={handlePortalLogin} className="space-y-4">
                      {authRole === 'teacher' ? (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="p-teacher-code">
                            선생님 선택
                          </label>
                          <select
                            id="p-teacher-code"
                            value={inputTeacherCode}
                            onChange={(e) => setInputTeacherCode(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 cursor-pointer"
                            autoFocus
                          >
                            <option value="">선생님 선택</option>
                            {teachers.map((tea) => (
                              <option key={tea.code} value={tea.code}>
                                [{tea.code}] {tea.name} 선생님
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-normal flex items-start gap-1.5">
                          <Info size={14} className="shrink-0 text-indigo-600 mt-0.5" />
                          <span>학교 관리자는 교사 목록을 등록·관리할 수 있습니다.</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="p-password">
                          인증 비밀번호
                        </label>
                        <input
                          id="p-password"
                          type="password"
                          placeholder="비밀번호를 입력하세요"
                          value={inputPassword}
                          onChange={(e) => setInputPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-800 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-650"
                        />
                      </div>

                      {authError && (
                        <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-medium">
                          <AlertCircle size={15} className="shrink-0 mt-0.5" />
                          <span>{authError}</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAdminOpen(false)}
                          className="flex-1 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
                        >
                          조회 화면으로
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm hover:shadow"
                        >
                          인증 및 로그인
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            )
          ) : loggedStudent ? (
            // Mode 2: Student Individual Result View
            <motion.div
              key="result-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ResultCard 
                sessionData={loggedStudent}
                onBack={handleStudentLogout}
                subjectMaxScores={subjectMaxScores}
                subjectCompletionStates={subjectCompletionStates}
                signatures={signatures}
                teacherSettings={teacherSettings}
                onSaveSignature={handleSaveSignature}
                onDeleteSignature={handleDeleteSignature}
                allEvaluations={allEvaluations}
                teachers={teachers}
                allStudents={allStudents}
              />
            </motion.div>
          ) : (
            // Mode 3: Student Credentials Input / Login view
            <motion.div
              key="login-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Educational Platform Welcome Sub-Banner */}
              <div className="text-center space-y-2 max-w-lg mx-auto mt-4 animate-fadeIn">
                <span className="text-[10px] sm:text-xs font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                  🏫 수행평가 결과 간편 조회
                </span>
                <p className="text-xs text-slate-500 font-semibold px-4 leading-relaxed font-sans">
                  수행평가 결과를 학생 개인이 조회할 수 있습니다.
                </p>
              </div>

              <LoginCard 
                onLoginSuccess={handleStudentLogin}
                onValidateStudent={handleValidateStudent}
                excelUploads={excelUploads}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Trustfooter */}
      <footer className="py-6 border-t border-slate-200/60 text-center text-xs text-slate-400 print:hidden mt-12 bg-white flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-500 text-[11px]">
            수행평가 결과 조회 시스템 v1.1
          </span>
          <span className="text-slate-350">|</span>
          <button 
            type="button"
            onClick={handleDownloadPrivacyFile}
            className="font-bold text-indigo-700 hover:text-indigo-900 transition-colors cursor-pointer text-[11px] underline underline-offset-2"
          >
            개인정보처리방침
          </button>
        </div>
        <span className="text-[10px]">Copyright © 2026 INBIGO. All Rights Reserved.</span>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div id="privacy-policy-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn select-text">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-indigo-900">
                <span className="font-extrabold text-base tracking-tight">개인정보처리방침</span>
              </div>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 transition duration-150 font-black cursor-pointer bg-slate-200/50 hover:bg-slate-200 p-1.5 rounded-full"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-left font-sans select-text scrollbar-thin scrollbar-thumb-slate-200">
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                {renderMarkdown(privacyPolicy || DEFAULT_PRIVACY_POLICY)}
              </div>
            </div>
            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-150 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-5 py-2.5 bg-indigo-900 text-white font-extrabold rounded-xl text-xs hover:bg-indigo-950 transition-all duration-150 cursor-pointer shadow-sm hover:shadow"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
