/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import LoginCard from './components/LoginCard';
import ResultCard from './components/ResultCard';
import AdminDashboard from './components/AdminDashboard';
import AdminManager from './components/AdminManager';
import { EvaluationState, Teacher, StudentSession, RegisteredStudent } from './types';
import { doc, onSnapshot, setDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
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

export default function App() {
  // All evaluations in the database
  const [allEvaluations, setAllEvaluations] = useState<EvaluationState[]>([]);

  // Registered students roster managed by administration
  const [allStudents, setAllStudents] = useState<RegisteredStudent[]>([]);

  // Subject-level final max score configurations
  const [subjectMaxScores, setSubjectMaxScores] = useState<Record<string, string>>({});

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

  // Student signatures mapping. Key: `${teacherCode}_${subject}_${studentId}` -> signatureDataUrl
  const [signatures, setSignatures] = useState<Record<string, string>>({});

  // Subscribe to Subject Settings in real-time from Firestore
  useEffect(() => {
    const collRef = collection(db, 'subjectSettings');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const scores: Record<string, string> = {};
      snap.forEach((d) => {
        const data = d.data();
        scores[d.id] = data.maxScore !== undefined ? String(data.maxScore) : '';
      });
      setSubjectMaxScores(scores);
    }, (error) => {
      console.warn("Firestore subjectSettings subscription failed: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Teacher Settings in real-time from Firestore
  useEffect(() => {
    const collRef = collection(db, 'teacherSettings');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const settings: Record<string, boolean> = {};
      snap.forEach((d) => {
        const data = d.data();
        settings[d.id] = !!data.signatureEnabled;
      });
      setTeacherSettings(settings);
    }, (error) => {
      console.warn("Firestore teacherSettings subscription failed: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Student Signatures in real-time from Firestore
  useEffect(() => {
    const collRef = collection(db, 'signatures');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const sigs: Record<string, string> = {};
      snap.forEach((d) => {
        const data = d.data();
        sigs[d.id] = data.signatureDataUrl || '';
      });
      setSignatures(sigs);
    }, (error) => {
      console.warn("Firestore signatures subscription failed: ", error);
    });

    return () => unsubscribe();
  }, []);

  // 1. Subscribe to Teachers directory in real-time from Firestore
  useEffect(() => {
    const collRef = collection(db, 'teachers');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const list: Teacher[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          code: d.id,
          name: data.name || '',
          password: data.password || '',
        });
      });
      list.sort((a, b) => a.code.localeCompare(b.code));
      setTeachers(list);
    }, (error) => {
      console.warn("Firestore teachers subscription failed: ", error);
    });

    return () => unsubscribe();
  }, []);

  // 1.5. Subscribe to Students directory in real-time from Firestore
  useEffect(() => {
    const collRef = collection(db, 'students');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const list: RegisteredStudent[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          studentId: d.id,
          name: data.name || '',
          birthdate: data.birthdate || '',
        });
      });
      list.sort((a, b) => a.studentId.localeCompare(b.studentId));
      setAllStudents(list);
    }, (error) => {
      console.warn("Firestore students subscription failed: ", error);
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to All Evaluations in real-time from Firestore
  useEffect(() => {
    const collRef = collection(db, 'evaluation');
    const unsubscribe = onSnapshot(collRef, (snap) => {
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
        });
      });
      setAllEvaluations(list);
    }, (error) => {
      console.warn("Firestore evaluations subscription failed: ", error);
    });

    return () => unsubscribe();
  }, []);

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
    try {
      const docRef = doc(db, 'evaluation', newDocId);
      await setDoc(docRef, {
        ...newState,
        id: newDocId,
        teacherCode: loggedTeacher?.code || '',
      });
      return newDocId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `evaluation/${newDocId}`);
      throw err;
    }
  };

  const handleUpdateEvaluation = async (id: string, newState: EvaluationState) => {
    try {
      const docRef = doc(db, 'evaluation', id);
      await setDoc(docRef, {
        ...newState,
        id: id,
        teacherCode: loggedTeacher?.code || '',
      });
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
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `subjectSettings/${settingId}`);
    }
  };

  const handleToggleSignature = async (enabled: boolean) => {
    if (!loggedTeacher) return;
    const cleanTeacherCode = loggedTeacher.code.trim();

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

  const handleSaveSignature = async (subject: string, studentId: string, studentName: string, signatureDataUrl: string) => {
    const tCode = loggedStudent?.teacherCode || selectedTeacherCode || '';
    if (!tCode) return;
    const cleanTeacherCode = tCode.trim();
    const cleanSubject = subject.trim();
    const cleanStudentId = studentId.trim();
    const signatureId = `${cleanTeacherCode}_${cleanSubject}_${cleanStudentId}`;

    try {
      const docRef = doc(db, 'signatures', signatureId);
      await setDoc(docRef, {
        teacherCode: cleanTeacherCode,
        subject: cleanSubject,
        studentId: cleanStudentId,
        studentName: studentName.trim(),
        signatureDataUrl,
        signedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `signatures/${signatureId}`);
    }
  };

  const handleDeleteSignature = async (subject: string, studentId: string) => {
    const tCode = loggedStudent?.teacherCode || selectedTeacherCode || '';
    if (!tCode) return;
    const cleanTeacherCode = tCode.trim();
    const cleanSubject = subject.trim();
    const cleanStudentId = studentId.trim();
    const signatureId = `${cleanTeacherCode}_${cleanSubject}_${cleanStudentId}`;

    try {
      const docRef = doc(db, 'signatures', signatureId);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `signatures/${signatureId}`);
    }
  };

  const handleDeleteEvaluation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'evaluation', id));
      if (activeEvaluationId === id) {
        setActiveEvaluationId('');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `evaluation/${id}`);
    }
  };

  // Bulk update teachers roster (Admin view)
  const handleUpdateTeachers = async (newTeachers: Teacher[]) => {
    setTeachers(newTeachers);
    try {
      for (const t of newTeachers) {
        const docRef = doc(db, 'teachers', t.code);
        await setDoc(docRef, {
          code: t.code,
          name: t.name,
          password: t.password || ''
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teachers');
    }
  };

  const handleDeleteTeacher = async (code: string, name: string) => {
    const updated = teachers.filter(t => t.code !== code);
    setTeachers(updated);
    
    try {
      await deleteDoc(doc(db, 'teachers', code));
      
      // Delete all evaluations owned by this teacher
      const evalsToDelete = allEvaluations.filter(e => e.teacherCode === code);
      for (const ev of evalsToDelete) {
        if (ev.id) {
          await deleteDoc(doc(db, 'evaluation', ev.id));
        }
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
    setAllStudents(newStudents);
    try {
      for (const s of newStudents) {
        const docRef = doc(db, 'students', s.studentId);
        await setDoc(docRef, {
          studentId: s.studentId,
          name: s.name,
          birthdate: s.birthdate
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  };

  const handleDeleteStudent = async (studentId: string, name: string) => {
    setAllStudents(prev => prev.filter(s => s.studentId !== studentId));
    try {
      await deleteDoc(doc(db, 'students', studentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
    }
  };

  const handleToggleAdmin = () => {
    setIsAdminOpen(!isAdminOpen);
    setLoggedStudent(null);
  };

  const handleStudentLogin = (sessionData: StudentSession) => {
    setLoggedStudent(sessionData);
  };

  const handleStudentLogout = () => {
    setLoggedStudent(null);
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

      setLoggedTeacher(matchedTeacher);
      
      // Auto-select starting evaluation if one exists
      const matchedEvals = allEvaluations.filter(e => e.teacherCode === matchedTeacher.code);
      if (matchedEvals.length > 0) {
        setActiveEvaluationId(matchedEvals[0].id || '');
      } else {
        setActiveEvaluationId('');
      }

      setAuthError('');
      setInputTeacherCode('');
      setInputPassword('');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
  };

  const handleTeacherLogout = () => {
    setLoggedTeacher(null);
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
            : currentStudentEvaluation?.title || '성적 조회'
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
                  teacherSettings={teacherSettings}
                  signatures={signatures}
                  onToggleSignature={handleToggleSignature}
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
                signatures={signatures}
                signatureEnabled={!!teacherSettings[(loggedStudent.teacherCode || '').trim()]}
                onSaveSignature={handleSaveSignature}
                onDeleteSignature={handleDeleteSignature}
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
                teacherEvaluations={studentTeacherEvaluations}
                onLoginSuccess={handleStudentLogin}
                teachers={teachers}
                selectedTeacherCode={selectedTeacherCode}
                onSelectTeacher={setSelectedTeacherCode}
                allStudents={allStudents}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Trustfooter */}
      <footer className="py-6 border-t border-slate-200/60 text-center text-xs text-slate-400 print:hidden mt-12 bg-white flex flex-col items-center justify-center gap-1">
        <span className="font-semibold text-slate-500 flex items-center gap-1 text-[11px]">
          수행평가 결과 조회 시스템 v2.5
        </span>
        <span className="text-[10px]">Copyright © 2026 INBIGO. All Rights Reserved.</span>
      </footer>
    </div>
  );
}
