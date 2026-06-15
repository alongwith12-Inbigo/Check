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
  Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Teacher } from '../types';
import { findTeacherCodeKey, findTeacherNameKey, findTeacherPasswordKey } from '../utils';
import { UserPlus } from 'lucide-react';

interface AdminManagerProps {
  teachers: Teacher[];
  onUpdateTeachers: (newTeachers: Teacher[]) => void;
  onDeleteTeacher: (code: string, name: string) => void;
  onLogout: () => void;
}

export default function AdminManager({ 
  teachers, 
  onUpdateTeachers, 
  onDeleteTeacher, 
  onLogout 
}: AdminManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // State for individual teacher registration & edit
  const [editingTeacherCode, setEditingTeacherCode] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk xlsx parsing
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
          setErrorMsg('엑셀 파일 분석 실패: 유효한 행 데이터를 발견할 수 없습니다.');
          return;
        }

        const codeKey = findTeacherCodeKey(cleanHeaders);
        const nameKey = findTeacherNameKey(cleanHeaders);
        const passwordKey = findTeacherPasswordKey(cleanHeaders);

        if (!codeKey || !nameKey) {
          setErrorMsg(
            `필수 컬럼 식별 불가: 선생님 엑셀에 '교사코드'와 '선생님이름'이 감지되지 않았습니다.\n` +
            `감지된 헤더 속성: [${cleanHeaders.join(', ')}]`
          );
          return;
        }

        // Add records to teachers collection
        let successCount = 0;
        let skippedCount = 0;
        const updatedTeachers = [...teachers];

        for (const row of rawRows) {
          const rawCode = String(row[codeKey]).trim();
          const rawName = String(row[nameKey]).trim();
          const rawPassword = passwordKey ? String(row[passwordKey] || '').trim() : '';

          // Standardize code to 3-digit length nicely (e.g. "98" -> "098" or "101" -> "101")
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

          // Merge or update existing item
          const idx = updatedTeachers.findIndex(t => t.code === formattedCode);
          const existingPw = idx >= 0 ? (updatedTeachers[idx].password || '') : '';
          const finalPw = rawPassword || existingPw || '1004';

          const updatedTeacherData: Teacher = { 
            code: formattedCode, 
            name: rawName,
            password: finalPw
          };

          if (idx >= 0) {
            updatedTeachers[idx] = updatedTeacherData;
          } else {
            updatedTeachers.push(updatedTeacherData);
          }
          successCount++;
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

        setSuccessMsg(
          `엑셀 일괄 등록 완료: 교사 ${successCount}명을 추가/동기화하였습니다.` +
          (skippedCount > 0 ? ` (부적절한 형식 혹은 공백 행 ${skippedCount}개는 제외됨)` : '')
        );
      } catch (err) {
        console.error(err);
        setErrorMsg('엑셀 파일을 파싱하여 교사 정보를 등록하지 못했습니다. 적절한 .xlsx 통합 문서를 열어주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processTeachersExcel(file);
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
      processTeachersExcel(e.dataTransfer.files[0]);
    }
  };

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

    const teaData: Teacher = {
      code: formattedCode,
      name: cleanName,
      password: cleanPassword || '1004'
    };

    if (idx >= 0) {
      updatedTeachers[idx] = teaData;
      setSuccessMsg(`"${cleanName}" 선생님(코드: ${formattedCode})의 계정 정보가 개별 수정되었습니다.`);
    } else {
      updatedTeachers.push(teaData);
      setSuccessMsg(`"${cleanName}" 선생님(코드: ${formattedCode}) 등록이 완료되었습니다.`);
    }

    // Always sort by teacher code in ascending numeric-aware order
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

  const handleStartEdit = (teacher: Teacher) => {
    setEditingTeacherCode(teacher.code);
    setNewCode(teacher.code);
    setNewName(teacher.name);
    setNewPassword(teacher.password || '1004');
    setErrorMsg('');
    setSuccessMsg('');
    
    // Smooth scroll to indiv registration/edition form
    const formPanel = document.getElementById('individual-teacher-form');
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

  const handleDelete = (code: string, name: string) => {
    if (window.confirm(`"${name}" 선생님(코드: ${code}) 계정을 목록에서 정말 삭제하시겠습니까?\n삭제할 경우 해당 교사가 업로드한 평가 성적도 자동 삭제됩니다.`)) {
      onDeleteTeacher(code, name);
      setSuccessMsg(`"${name}" 선생님 계정 및 등록한 학생 성적이 삭제되었습니다.`);
    }
  };

  const filteredTeachers = teachers.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.code.includes(term) || t.name.toLowerCase().includes(term);
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
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-350 rounded-xl text-xs font-bold text-red-650 bg-white hover:bg-red-50 hover:border-red-200 hover:shadow-xs transition cursor-pointer"
        >
          <LogOut size={13} /> 관리자 로그아웃
        </button>
      </div>

      {/* Grid: Left - Setup Form / Right - List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left column: Excel bulk uploader and Individual registration */}
        <div className="md:col-span-1 space-y-4">
          
          {/* Bulk Excel Upload */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
              <Upload size={16} className="text-emerald-600" />
              교사 목록 엑셀 일괄 등록
            </h3>

            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center bg-slate-50/20 py-8 ${
                dragActive 
                  ? 'border-indigo-600 bg-indigo-50/40' 
                  : 'border-slate-305 hover:border-indigo-550 hover:bg-slate-50/60'
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
              <FileSpreadsheet size={20} className="text-slate-400 mb-2" />
              <p className="text-[11px] font-bold text-slate-755 leading-normal">
                교사 목록 엑셀 드롭 또는 클릭
              </p>
              <p className="text-[9px] text-slate-420 mt-1 leading-normal">
                ※ 칼럼에 <strong>교사코드</strong>(세자리), <strong>선생님이름</strong>,<br />그리고 선택사항인 <strong>비밀번호</strong>가 구성될 수 있음
              </p>
            </div>
          </div>

          {/* Individual Teacher Registration Form */}
          <div id="individual-teacher-form" className={`p-5 rounded-2xl border transition-all duration-300 space-y-4 shadow-sm ${
            editingTeacherCode !== null 
              ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-200/50' 
              : 'bg-white border-slate-200'
          }`}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
              {editingTeacherCode !== null ? (
                <>
                  <Edit size={16} className="text-amber-600 animate-pulse" />
                  <span className="text-amber-900">교사 개별 정보 변경 중</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} className="text-indigo-600" />
                  <span>교사 개별 등록/수정</span>
                </>
              )}
            </h3>

            <form onSubmit={handleAddTeacherIndividually} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-655" htmlFor="t-code">
                    교사코드 (3자리 숫자)
                  </label>
                  {editingTeacherCode !== null && (
                    <span className="text-[9px] text-amber-750 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                      수정 모드: 변경 불가
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
                      : 'border-slate-300 focus:ring-indigo-300 focus:border-indigo-505'
                  }`}
                  disabled={editingTeacherCode !== null}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-655 mb-1" htmlFor="t-name">
                  담당 선생님 성함
                </label>
                <input 
                  id="t-name"
                  type="text" 
                  placeholder="예: 이혜영"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-505 font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-655 mb-1" htmlFor="t-password">
                  선생님 비밀번호
                </label>
                <input 
                  id="t-password"
                  type="text" 
                  placeholder="미입력시 기본값 1004"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-505 font-mono"
                />
              </div>

              <div className="pt-1 space-y-2">
                <button 
                  type="submit"
                  className={`w-full py-2 text-white rounded-xl text-xs font-bold transition duration-150 flex items-center justify-center gap-1.5 shadow-xs hover:shadow-sm cursor-pointer ${
                    editingTeacherCode !== null
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {editingTeacherCode !== null ? (
                    <>
                      <CheckCircle2 size={13} /> 변경 정보 저장 완료
                    </>
                  ) : (
                    <>
                      <UserPlus size={13} /> 교사 등록 / 변경 적용
                    </>
                  )}
                </button>

                {editingTeacherCode !== null && (
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    수정 취소 (새 교사 등록으로)
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-[11px] text-indigo-950 space-y-1.5 shadow-xs">
            <span className="font-bold text-indigo-900 flex items-center gap-1">
              <Info size={14} className="text-indigo-600" />
              구글 실시간 클라우드 DB 연동 방식
            </span>
            <p className="leading-relaxed text-indigo-900/80">
              본 시스템은 구글 파이어스토어(Cloud Firestore) 클라우드 데이터베이스에 실시간으로 안전하게 자료를 동기화하고 연동 보존합니다. 입력 및 삭제된 내역은 즉각 클라우드에 반영되어 모든 접속자 단말에 동시 자동 동기화됩니다.
            </p>
          </div>

        </div>

        {/* Right column: Teachers roster list table */}
        <div className="md:col-span-2 space-y-4">
          
          {/* Messages Alert space */}
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* Roster Area card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Users size={16} className="text-slate-500" />
                  등록 교사 현황 ({teachers.length}명)
                </h3>
                <p className="text-[11px] text-slate-400">교사 데이터 검색</p>
              </div>

              <div className="relative max-w-xs w-full">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-450">
                  <Search size={14} />
                </span>
                <input 
                  type="text" 
                  placeholder="교사명 또는 코드(3자리) 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[420px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 font-sans z-10">
                    <th className="py-2.5 px-3 font-semibold text-center w-14 border-r border-slate-200">순서</th>
                    <th className="py-2.5 px-4 font-bold border-r border-slate-200 text-indigo-900">교사코드</th>
                    <th className="py-2.5 px-4 font-semibold border-r border-slate-200">담당 선생님 성함</th>
                    <th className="py-2.5 px-4 font-semibold border-r border-slate-200">비밀번호</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-32">관리 작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 italic">
                        {teachers.length === 0 
                           ? '현재 등록된 교사가 없습니다. 교사 목록 엑셀 파일(.xlsx)을 업로드해주십시오.'
                           : '검색어와 일치하는 선생님을 찾을 수 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((tea, index) => (
                      <tr key={tea.code} className={`transition-colors ${
                        editingTeacherCode === tea.code ? 'bg-amber-50 hover:bg-amber-100/80 font-medium' : 'hover:bg-slate-50/70'
                      }`}>
                        <td className="py-3 px-3 text-center text-slate-400 font-mono border-r border-slate-200">{index + 1}</td>
                        <td className="py-3 px-4 border-r border-slate-200 font-black font-mono text-indigo-700 tracking-wider">
                          <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[11px]">
                            {tea.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200 font-semibold text-slate-800 text-[12px]">{tea.name} 선생님</td>
                        <td className="py-3 px-4 border-r border-slate-200 font-mono text-slate-600 font-bold text-[11.5px]">{tea.password || '1004'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button 
                               type="button"
                               onClick={() => handleStartEdit(tea)}
                               className="p-1.5 px-2.5 border border-amber-200 text-amber-705 bg-amber-50/30 hover:bg-amber-50 hover:border-amber-300 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold shadow-2xs"
                            >
                              <Edit size={11} /> 수정
                            </button>
                            <button 
                               type="button"
                               onClick={() => handleDelete(tea.code, tea.name)}
                               className="p-1.5 px-2.5 border border-red-100 text-red-650 hover:bg-red-50 hover:border-red-200 rounded-lg transition duration-150 cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
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

          </div>

        </div>

      </div>

    </div>
  );
}
