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
import { EvaluationState, Teacher } from './types';
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

// Premium high-craft pre-populated sample evaluation data 
const DEFAULT_PRESET: EvaluationState = {
  subject: '정보 과학',
  round: '1',
  evaluationDetailName: '알고리즘 및 순서도 설계 평가',
  title: '정보 과학 (1차) 수행평가: 알고리즘 및 순서도 설계 평가',
  headers: ['학번', '이름', '생년월일', '동료평가(10)', '실기보고서(40)', '코드수행(50)', '합계(100)', '개별 성취피드백'],
  rows: [
    {
      '학번': '10101',
      '이름': '김하늘',
      '생년월일': '060512',
      '동료평가(10)': '10',
      '실기보고서(40)': '38',
      '코드수행(50)': '48',
      '합계(100)': '96',
      '개별 성취피드백': 'Python 정렬 알고리즘의 시간 복잡도를 올바르게 이해하고 이를 분할 정복 방식으로 우수하게 모듈화 설계한 점이 매우 탁월합니다. 팀원 기여도 또한 만점입니다.'
    },
    {
      '학번': '10102',
      '이름': '박민수',
      '생년월일': '061125',
      '동료평가(10)': '9',
      '실기보고서(40)': '35',
      '코드수행(50)': '42',
      '합계(100)': '86',
      '개별 성취피드백': '알고리즘 순서도 모델링 영역에서 우수한 논리 선형성을 보여줍니다. 다만 코드 구현 단계에서 변수 스코프를 전역 공간으로 전치시켜 선언한 부분이 아쉬우니 지역 변수로 축소 수정해 보길 권장합니다.'
    },
    {
      '학번': '10103',
      '이름': '이솔이',
      '생년월일': '060707',
      '동료평가(10)': '10',
      '실기보고서(40)': '40',
      '코드수행(50)': '50',
      '합계(100)': '100',
      '개별 성취피드백': '실습과 이론 모두 무결점에 수렴하는 뛰어난 마스터리를 발휘해 최고점을 기록하였습니다. 프로그램 종료 시점에 리소스 반환 처리를 추가한 디테일 또한 선생님으로서 깊은 인상을 받았습니다.'
    },
    {
      '학번': '10204',
      '이름': '최도현',
      '생년월일': '060303',
      '동료평가(10)': '8',
      '실기보고서(40)': '28',
      '코드수행(50)': '35',
      '합계(100)': '71',
      '개별 성취피드백': '인터페이스 흐름의 조형미가 아주 준수한 앱 데모를 구현하였습니다. 아쉽게도 제출 서한의 개요 기획문 중 기능 의성 상세 정의서 부분이 채워지지 않았으니 다음 평가 시 분량을 신경 써 주시기 바랍니다.'
    }
  ],
  uploadedAt: '2026-06-08 (샘플 탑재)'
};

export default function App() {
  const [evaluationState, setEvaluationState] = useState<EvaluationState>(DEFAULT_PRESET);

  // Separate logins states
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherCode, setSelectedTeacherCode] = useState('101');
  const [loggedTeacher, setLoggedTeacher] = useState<Teacher | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Admin login selection portal inputs
  const [inputTeacherCode, setInputTeacherCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [authRole, setAuthRole] = useState<'teacher' | 'admin'>('teacher');
  const [authError, setAuthError] = useState('');

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [loggedStudent, setLoggedStudent] = useState<Record<string, any> | null>(null);

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
        });
      });
      list.sort((a, b) => a.code.localeCompare(b.code));

      if (list.length === 0) {
        // Database is brand new. Let us auto-seed it with a working example teacher 101 out of the box!
        const defaultTeacher: Teacher = { code: '101', name: '김태평 (대표)' };
        setTeachers([defaultTeacher]);
        setDoc(doc(db, 'teachers', '101'), defaultTeacher).catch((err) => {
          console.error("Auto-seeding default teacher failed: ", err);
        });
        setDoc(doc(db, 'evaluation', '101'), DEFAULT_PRESET).catch((err) => {
          console.error("Auto-seeding default evaluation failed: ", err);
        });
      } else {
        setTeachers(list);
      }
    }, (error) => {
      console.warn("Firestore teachers subscription failed: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Sync selectedTeacherCode whenever teachers list updates to keep selection clean
  useEffect(() => {
    if (teachers.length > 0) {
      if (!teachers.some(t => t.code === selectedTeacherCode)) {
        setSelectedTeacherCode(teachers[0].code);
      }
    }
  }, [teachers, selectedTeacherCode]);

  // Helper to bulk upload/sync teachers list to Firestore
  const handleUpdateTeachers = async (newTeachers: Teacher[]) => {
    // Optimistically update local state so UI updates instantly without latency
    setTeachers(newTeachers);
    try {
      for (const t of newTeachers) {
        const docRef = doc(db, 'teachers', t.code);
        await setDoc(docRef, {
          code: t.code,
          name: t.name
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teachers');
    }
  };

  const handleDeleteTeacher = async (code: string, name: string) => {
    // Optimistic delete
    const updated = teachers.filter(t => t.code !== code);
    setTeachers(updated);
    
    try {
      await deleteDoc(doc(db, 'teachers', code));
      await deleteDoc(doc(db, 'evaluation', code));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teachers/${code}`);
    }

    // Reset selected/logged code if corresponding teacher deleted
    if (selectedTeacherCode === code) {
      const fallbackCode = updated[0]?.code || '';
      setSelectedTeacherCode(fallbackCode);
    }
    if (loggedTeacher?.code === code) {
      setLoggedTeacher(null);
    }
  };

  // 2. Dynamic evaluation state listener from Firestore
  useEffect(() => {
    const targetCode = loggedTeacher ? loggedTeacher.code : selectedTeacherCode;
    if (!targetCode) return;

    const docRef = doc(db, 'evaluation', targetCode);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEvaluationState({
          title: data.title || '',
          subject: data.subject || '',
          round: data.round || '',
          evaluationDetailName: data.evaluationDetailName || '',
          headers: data.headers || [],
          rows: data.rows || [],
          uploadedAt: data.uploadedAt || null,
        });
      } else {
        // Fallback to presets or empty
        if (targetCode === '101') {
          setEvaluationState(DEFAULT_PRESET);
        } else {
          setEvaluationState({
            title: '수행평가 결과',
            subject: '',
            round: '',
            evaluationDetailName: '',
            headers: [],
            rows: [],
            uploadedAt: null,
          });
        }
      }
    }, (error) => {
      console.warn("Firestore evaluation loader check failed: ", error);
    });

    return () => unsubscribe();
  }, [loggedTeacher?.code, selectedTeacherCode]);

  // Sync state changes with Cloud Firestore (real-time broadcast to all client screens)
  const handleUpdateEvaluationState = async (newState: EvaluationState) => {
    const targetCode = loggedTeacher ? loggedTeacher.code : '101';
    setEvaluationState(newState);
    try {
      const docRef = doc(db, 'evaluation', targetCode);
      await setDoc(docRef, {
        title: newState.title || '',
        subject: newState.subject || '',
        round: newState.round || '',
        evaluationDetailName: newState.evaluationDetailName || '',
        headers: newState.headers || [],
        rows: newState.rows || [],
        uploadedAt: newState.uploadedAt || null,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `evaluation/${targetCode}`);
    }
  };

  const handleToggleAdmin = () => {
    setIsAdminOpen(!isAdminOpen);
    // Logout student if entering admin mode to keep security boundaries clean
    setLoggedStudent(null);
  };

  const handleStudentLogin = (studentData: Record<string, any>) => {
    setLoggedStudent(studentData);
  };

  const handleStudentLogout = () => {
    setLoggedStudent(null);
  };

  // Auth form submissions
  const handlePortalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authRole === 'admin') {
      if (inputPassword === '1004') {
        setIsAdminLoggedIn(true);
        setAuthError('');
        setInputPassword('');
      } else {
        setAuthError('관리자 비밀번호가 정확하지 않습니다. (비번: 1004)');
      }
    } else {
      const trimmedCode = inputTeacherCode.trim();
      if (!trimmedCode || !inputPassword.trim()) {
        setAuthError('교사 코드와 비밀번호를 모두 가입해 주십시오.');
        return;
      }
      if (inputPassword !== '1004') {
        setAuthError('비밀번호가 일치하지 않습니다. (비밀번호: 1004)');
        return;
      }

      // Check if code matches any registered teacher strictly. No hardcoded or unauthorized bypass of the roster database.
      const matchedTeacher = teachers.find(t => t.code === trimmedCode);

      if (matchedTeacher) {
        setLoggedTeacher(matchedTeacher);
        setAuthError('');
        setInputTeacherCode('');
        setInputPassword('');
      } else {
        setAuthError(`등록되지 않은 선생님 코드(${trimmedCode})입니다. 학교 총괄 관리자가 교원 목록에 등록했는지 다시 점검하고 시도해 보십시오.`);
      }
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
        evaluationTitle={evaluationState.title || (loggedTeacher ? `${loggedTeacher.name} 선생님의 과목` : '성적 조회')} 
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {isAdminOpen ? (
            // Admin portal route selection
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
                />
              </motion.div>
            ) : loggedTeacher ? (
              // Mode 1B: Teacher evaluation scores publisher dashboard
              <motion.div
                key="teacher-dashboard-screen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <AdminDashboard 
                  evaluationState={evaluationState}
                  onUpdateState={handleUpdateEvaluationState}
                  onClose={() => setIsAdminOpen(false)}
                  loggedTeacher={loggedTeacher}
                  onLogout={handleTeacherLogout}
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
                    <h2 className="text-xl font-extrabold font-sans tracking-tight">교원 검증 포털 로그인</h2>
                    <p className="text-xs text-indigo-200 mt-1">담당 클래스의 배점을 관리하거나 교직원 목록을 증대하십시오.</p>
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
                            선생님 코드 (3자리 숫자)
                          </label>
                          <input
                            id="p-teacher-code"
                            type="text"
                            maxLength={3}
                            placeholder="예: 101"
                            value={inputTeacherCode}
                            onChange={(e) => setInputTeacherCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-800 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-650"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-normal flex items-start gap-1.5">
                          <Info size={14} className="shrink-0 text-indigo-600 mt-0.5" />
                          <span>학교 총괄 관리자는 본교 배정된 통합 교직원 대장을 일괄 제치하고 신규 교사 코드를 개설하는 권고 장치입니다.</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="p-password">
                          인증 비밀번호 (1004)
                        </label>
                        <input
                          id="p-password"
                          type="password"
                          placeholder="비밀번호(1004)를 기입하세요"
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
                          className="flex-1 py-3 bg-indigo-900 hover:bg-indigo-950 text-white border border-indigo-900 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          검증 및 승인
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
                evaluationState={evaluationState}
                studentData={loggedStudent}
                onBack={handleStudentLogout}
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
                  🏫 수시 수행평가 성적 간편 조회 엔진
                </span>
                <p className="text-xs text-slate-500 font-semibold px-4 leading-relaxed">
                  본 서비스는 교육 정보 보호 지침에 맞춰 지정된 선생님의 평가 점수와 개별 성취 환산 피드백을 타인 노출 없이 안전하게 1대1 즉시 대조합니다.
                </p>
              </div>

              <LoginCard 
                evaluationState={evaluationState} 
                onLoginSuccess={handleStudentLogin}
                teachers={teachers}
                selectedTeacherCode={selectedTeacherCode}
                onSelectTeacher={setSelectedTeacherCode}
              />
              
              {/* Default Mock Login Tutorial box for first timers */}
              {teachers.length > 0 && selectedTeacherCode === '101' && evaluationState.rows.length > 0 && evaluationState.uploadedAt?.includes('샘플') && (
                <div className="max-w-md mx-auto bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs space-y-2 text-indigo-900/80 shadow-xs">
                  <span className="font-bold block text-indigo-950 flex items-center gap-1">
                     💻 즉시 체험용 샘플 계정 안내 (선생님 테스트용)
                  </span>
                  <p className="leading-relaxed text-[11px]">
                    아직 교사 엑셀 파일을 업로드하지 않으셨다면, 아래의 샘플 계정으로 로그인 동작을 미리 체험해 보실 수 있습니다 (선생님 선택 목록에서 101 김태평 선생님 선택):
                  </p>
                  <div className="grid grid-cols-2 gap-2 bg-white/70 p-2.5 rounded-lg border border-indigo-100/50 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block">김하늘 학생</span>
                      <span className="block text-indigo-950">학번: <strong className="font-bold text-indigo-600">10101</strong></span>
                      <span className="block text-indigo-950">생일: <strong className="font-bold text-indigo-600">060512</strong></span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">이솔이 학생</span>
                      <span className="block text-indigo-950">학번: <strong className="font-bold text-indigo-600">10103</strong></span>
                      <span className="block text-indigo-950">생일: <strong className="font-bold text-indigo-600">060707</strong></span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    ※ 화면 우상단의 [교사 / 관리자 로그인] 에서 패스워드 <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">1004</code>를 입력하시면 실제 엑셀 업로드 및 전체 조율을 하실 수 있습니다.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Trustfooter */}
      <footer className="py-6 border-t border-slate-200/60 text-center text-xs text-slate-400 print:hidden mt-12 bg-white flex flex-col items-center justify-center gap-1">
        <span className="font-semibold text-slate-500 flex items-center gap-1 text-[11px]">
           수행평가 결과 조회 시스템 v2.0
        </span>
        <span className="text-[10px]">Copyright © 2026 Educational Grade Web Engine. All Rights Reserved.</span>
      </footer>
    </div>
  );
}
