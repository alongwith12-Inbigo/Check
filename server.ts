import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set higher body payload limits to handle PDF files and image representations
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // Initialize the server-side Gemini client with telemetries
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // API: Health probe
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // API: Premium AI OCR Multi-stage Document Table Extractor 
  app.post("/api/extract", async (req: any, res: any) => {
    let uploadResult: any = null;
    let randomId = Math.random().toString(36).substring(2, 11);
    let mimeType = "application/pdf";
    try {
      const { pdfBase64, subject, targetGradeClass } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF 또는 이미지 파일 데이터가 누락되었습니다." });
      }
      if (!subject) {
        return res.status(400).json({ error: "평가 과목명이 입력되지 않았습니다." });
      }
      if (!targetGradeClass) {
        return res.status(400).json({ error: "대상 학년반이 입력되지 않았습니다." });
      }

      // Identify MIME type and isolate content
      let cleanBase64 = pdfBase64;
      if (pdfBase64.startsWith("data:")) {
        const commaIdx = pdfBase64.indexOf(",");
        if (commaIdx !== -1) {
          const header = pdfBase64.substring(0, commaIdx);
          const mimeMatch = header.match(/data:([^;]+);/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          cleanBase64 = pdfBase64.substring(commaIdx + 1);
        }
      }

      console.log(`[OCR Engine] Request received for Subject: "${subject}", Class Code: "${targetGradeClass}", Type: "${mimeType}"`);

      // Write base64 to local temporary file for file-based upload (Gemini requires Files API for PDF content)
      const tempDir = os.tmpdir();
      randomId = Math.random().toString(36).substring(2, 11);
      const ext = mimeType === "application/pdf" ? ".pdf" : 
                  (mimeType === "image/png" ? ".png" : 
                  (mimeType === "image/jpeg" || mimeType === "image/jpg" ? ".jpg" : 
                  (mimeType === "image/webp" ? ".webp" : ".pdf")));
      const tempFilePath = path.join(tempDir, `extract_${Date.now()}_${randomId}${ext}`);
      
      try {
        fs.writeFileSync(tempFilePath, Buffer.from(cleanBase64, 'base64'));
        console.log(`[OCR Engine] Created temporary file: ${tempFilePath}`);

        // Upload the file using the official Gemini Files API
        uploadResult = await ai.files.upload({
          file: tempFilePath,
          config: {
            mimeType: mimeType,
          }
        });
        console.log(`[OCR Engine] Successfully uploaded file to Gemini: ${uploadResult.name} -> ${uploadResult.uri}`);
      } catch (uploadErr: any) {
        console.error("[OCR Engine Upload Fail]", uploadErr);
        throw new Error(`Gemini API 파일 업로드 도중 에러가 발생했습니다: ${uploadErr.message || uploadErr}`);
      }

      // System Instructions that strict match user rules and include name extraction
      const systemPrompt = `당신은 학교 수행평가 일람표(PDF, 이미지)를 분석하여 학생 성적 데이터를 구조화하는 OCR 데이터 추출 전문가입니다.

목표: 수행평가 일람표 이미지 또는 PDF에서 학생별 수행평가 점수 및 성명을 추출하여 데이터베이스 저장용 JSON 형태로 변환한다.

사용자가 입력한 정보:
- 과목명: "${subject}"
- 학년반 코드: "${targetGradeClass}"

[중요 규칙]
1. 성명 추출: 각 학생의 '성명(이름)'을 표에 표기된 대로 정확히 추출하여 "student_name" 필드에 기재하시오 (예: "김자운", "아나스타샤"). 이름에 특수문자나 공백이 있다면 지우고 정확한 한글/외국어 이름형태로 반환하시오.
2. 학번 생성: 반/번호 열을 이용하여 학번을 생성한다.
   규칙: 학번 = 학년반코드 + 번호(2자리)
   예: 학년반코드가 ${targetGradeClass}일 때, 번호가 1이면 "${targetGradeClass}01", 번호가 9면 "${targetGradeClass}09", 번호가 10이면 "${targetGradeClass}10", 번호가 25면 "${targetGradeClass}25".
3. 수행평가 영역 추출: 성명 열과 합계/총점 열 사이의 모든 열을 수행평가 영역으로 인식한다. 영역 개수는 과목마다 다를 수 있으므로 고정된 개수를 가정하지 말고 일람표 상에서 자동 판단한다.
   - 영역명 제목은 원본 내용을 최대한 유지한다.
   - 영역명 아래/주변에 표시된 만점을 읽어 정수 형태로 저장한다. 정수 형태로 변환하며 소수점과 퍼센트(%) 정보는 완전히 제거한다.
     예: "빅데이터 분석 프로젝트 (만점 20.00, 20.00%)" -> "빅데이터 분석 프로젝트" (만점: 20)
4. 합계 만점 계산: 합계/총점 열에는 만점 정보가 없을 수 있으므로, 모든 개별 수행평가 영역의 만점을 합산하여 합계 만점(total_max_score)을 계산한다.
5. 학생 점수 추출: 각 학생 행에서 '학번(student_id)', '성명(student_name)', '체크된 각 수행영역 점수(scores)', '합계 점수(total)'를 추출한다. 학생 합계 점수는 OCR로 읽은 것을 그대로 무시하지 말고 사용하며 가공/재계산하지 않는다.
6. 추출 제외 대상: 학생이 아닌 통계 데이터 행은 절대 추출하지 않고 조기 종결한다. (예: '응시생수', '총점', '평균', '학과응시생수', '학과총점', '학과평균' 등 제외) 즉, 마지막 학생 번호 행까지만 완벽하게 추출한다.
7. 출력 목록에는 오직 JSON 구조 하나만 반환해야 하며, 다른 서론이나 텍스트, 설명, 주석 등을 절대 붙이지 말 것. Markdown 코드블록(\`\`\`json ...)도 포함하지 마시오.

반드시 다음 형식의 JSON 규칙을 완벽하게 따라 출력하십시오:
{
  "subject": "${subject}",
  "class_code": "${targetGradeClass}",
  "areas": [
    {
      "name": "수행평가 영역명",
      "max_score": 만점값(정수)
    }
  ],
  "total_max_score": 합계 만점값(정수),
  "students": [
    {
      "student_id": "학번 (예: ${targetGradeClass}01)",
      "student_name": "성명 (예: 김자운)",
      "scores": {
        "수행평가 영역명": 점수(숫자 또는 점수문자열)
      },
      "total": 합계점수(숫자 또는 점수문자열)
    }
  ]
}`;

      let response;
      try {
        // Call server-side Gemini 3.5 Flash using the uploaded file reference (robust PDF rendering)
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              fileData: {
                fileUri: uploadResult.uri,
                mimeType: uploadResult.mimeType
              }
            },
            "성적이 인쇄된 학교 수행평가 일람표 문서를 정밀하게 인식 및 대조하고 구조화된 JSON으로 복원해 주십시오.",
          ],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
          },
        });
      } catch (genErr: any) {
        console.error("[OCR Engine Generation Fail]", genErr);
        throw new Error(`Gemini AI 분석 도중 에러가 발생했습니다: ${genErr.message || genErr}`);
      }

      const textOutput = response.text || "";
      if (!textOutput.trim()) {
        throw new Error("Gemini AI API가 일람표에 관한 빈 문자열 데이터를 반환했습니다.");
      }

      // Parse JSON from model
      const parsedData = JSON.parse(textOutput.trim());
      
      // Pivot extracted areas to the {headers, rows} matrix requested by client-side table rendering
      const areas = parsedData.areas || [];
      const totalMax = parsedData.total_max_score || 0;
      
      const areaHeaders = areas.map((a: any) => `${a.name} (${a.max_score}점)`);
      const totalHeaderKey = totalMax > 0 ? `합계 (${totalMax}점)` : '합계';
      const finalHeaders = ['학번', '성명', ...areaHeaders, totalHeaderKey];

      const finalRows = (parsedData.students || []).map((stud: any) => {
        const row: any = {
          '학번': stud.student_id,
          '성명': stud.student_name || stud.name || ''
        };
        
        // Fill area scores
        areas.forEach((area: any) => {
          const headerName = `${area.name} (${area.max_score}점)`;
          const rawScore = stud.scores[area.name] ?? stud.scores[Object.keys(stud.scores).find(k => k.trim() === area.name.trim()) || ''] ?? '0';
          row[headerName] = String(rawScore);
        });

        // Fill overall total score
        row[totalHeaderKey] = String(stud.total ?? '0');
        return row;
      });

      // Maintain ascending sort by student ID
      finalRows.sort((a: any, b: any) => String(a['학번']).localeCompare(String(b['학번'])));

      res.json({
        success: true,
        headers: finalHeaders,
        rows: finalRows,
        subject: parsedData.subject || subject,
        class_code: parsedData.class_code || targetGradeClass
      });

    } catch (error: any) {
      console.error("[Gemini OCR Controller Error]", error);
      res.status(500).json({
        success: false,
        error: error.message || "학교 수행평가 일람표 AI OCR 추출 작업 중 시스템 오류가 발생했습니다."
      });
    } finally {
      // Cleanup locally generated temp file
      const filesInTemp = fs.readdirSync(os.tmpdir());
      const myTempFiles = filesInTemp.filter(f => f.startsWith('extract_') && (f.endsWith('.pdf') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')));
      
      myTempFiles.forEach(f => {
        const p = path.join(os.tmpdir(), f);
        try {
          const stat = fs.statSync(p);
          if (Date.now() - stat.mtimeMs > 5000 || p.includes(randomId)) {
            fs.unlinkSync(p);
            console.log(`[OCR Engine Cleanup] Deleted local temp file: ${p}`);
          }
        } catch (err) {
          // silent error
        }
      });

      // Cleanup remote uploaded file on Gemini File API to prevent leakage of PII data
      if (uploadResult && uploadResult.name) {
        try {
          await ai.files.delete({ name: uploadResult.name });
          console.log(`[OCR Engine Cleanup] Successfully deleted remote Gemini file: ${uploadResult.name}`);
        } catch (deleteErr) {
          console.error("[OCR Engine Cleanup Fail] Failed to release remote file catalog record:", deleteErr);
        }
      }
    }
  });

  // Client-side static resource mapping and dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Vite+Express] Backend server successfully bound on port ${PORT}`);
  });
}

startServer();
