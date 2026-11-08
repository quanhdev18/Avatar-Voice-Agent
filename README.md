# Sensei AI — học tiếng Nhật 1-1 với giáo viên AI

Người học Việt Nam vào "phòng học" kiểu Google Meet, nói chuyện realtime với **Yuki-sensei** (avatar người, nhép môi), có thể ngắt lời bằng giọng nói hoặc chat, xem bảng trắng (kanji + furigana + romaji + nghĩa tiếng Việt), làm quiz, và ôn lại từ vựng bằng flashcard SRS (SM-2).

> Chạy được ngay **không cần API key nào** (chỉ cần Postgres): app tự vào *chế độ demo* — đăng nhập demo, giáo viên demo chạy kịch bản bài học trong trình duyệt bằng giọng đọc của trình duyệt. Thêm key để bật lớp học thật.

## Kiến trúc

```
artifacts/
  sensei-ai/      Web app (Vite + React + Tailwind + shadcn/ui, wouter)
  api-server/     Express API + LiveKit Agent (Node) "Yuki-sensei"
    src/routes/        sensei.ts (token LiveKit, giới hạn phút), learner.ts (dashboard, bài học, sổ tay, lịch sử)
    src/senseiAgent.ts Agent: tool calls, phụ đề, barge-in, giới hạn thời gian, fallback avatar
    src/agent/         providers.ts (interface Voice/Avatar), prompt.ts (system prompt + cấu trúc buổi học)
lib/
  db/             Drizzle schema + giáo trình 10 bài N5 (src/curriculum/n5.ts) + SM-2 (src/srs.ts)
  api-spec/       OpenAPI (nguồn chân lý) → orval sinh lib/api-client-react + lib/api-zod
```

Luồng dữ liệu:

```
Trình duyệt ──POST /api/sensei/sessions──▶ API ──(kiểm tra phút/ngày, tạo Session)──▶ token LiveKit ngắn hạn
     │                                                                     (metadata: sessionId, lessonId)
     └──WebRTC──▶ LiveKit room ◀──── Agent Yuki-sensei (Gemini Live / OpenAI Realtime)
                     │  audio, video avatar (LiveAvatar)          │ tool calls → Postgres
                     │  data: caption / board / quiz / notebook   │ (sổ tay, tiến độ, lỗi)
                     ▼                                            ▼
             phụ đề song ngữ, bảng trắng, quiz       cuối buổi: transcript + tóm tắt + lỗi → Session
```

API key **không bao giờ** đến client; client chỉ nhận participant token LiveKit có TTL = thời lượng tối đa buổi học.

Ghi chú về stack: dự án được khởi tạo trên Replit với Vite + Express + Drizzle + Clerk, nên giữ nguyên thay vì Next.js + Prisma + Auth.js như bản đặc tả. Đăng nhập Google được bật trong Clerk dashboard. Tách giao diện/API/agent như trên vẫn đáp ứng các yêu cầu (key chỉ ở server, token ngắn hạn).

## Tính năng

| Màn hình | Có gì |
|---|---|
| Landing + đăng nhập | Clerk (Google) hoặc demo |
| Dashboard | trình độ, bài tiếp theo, streak, số thẻ cần ôn, phút đã dùng hôm nay |
| Phòng học `/classroom/:lessonId` | ô lớn avatar giáo viên, ô nhỏ camera người học (bật/tắt), phụ đề JP + VI, bảng trắng (furigana, romaji bật/tắt), quiz, chat/transcript, nút giơ tay, nhắc lại, nói chậm, mic, camera, đồng hồ, kết thúc |
| Sổ tay `/notebook` | từ vựng/ngữ pháp đã học, flashcard SM-2 (Quên/Khó/Nhớ/Dễ) |
| Lịch sử `/history` | transcript, tóm tắt, lỗi hay mắc |

Agent tools: `show_on_board`, `add_to_notebook`, `start_quiz`, `get_lesson`, `mark_lesson_progress`, `get_learner_profile`, `record_mistake`.

Xử lý lỗi: avatar lỗi/rớt → voice + ảnh tĩnh (portrait nhép môi); không có mic → tự chuyển sang chat và báo agent; mất kết nối → lưu buổi học. Giới hạn: `MAX_SESSION_MINUTES` mỗi buổi, `DAILY_MINUTE_LIMIT` mỗi ngày (bảng `usage_daily`, tính theo thời gian đo ở server).

## Lấy API key

| Biến | Lấy ở đâu |
|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | https://cloud.livekit.io → tạo project → Settings → Keys |
| `GOOGLE_API_KEY` | https://aistudio.google.com/apikey (Gemini Live API) |
| `OPENAI_API_KEY` (tuỳ chọn) | https://platform.openai.com/api-keys, đặt `VOICE_PROVIDER=openai` |
| `LIVEAVATAR_API_KEY`, `LIVEAVATAR_AVATAR_ID` (tuỳ chọn) | https://www.liveavatar.com (HeyGen LiveAvatar) → developer API key + chọn avatar; đặt `AVATAR_PROVIDER=liveavatar` |
| `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (tuỳ chọn) | https://dashboard.clerk.com → tạo app, bật Google trong *SSO connections* |

Về Simli: LiveKit Agents bản Node chưa có plugin Simli, nên provider mặc định là LiveAvatar (HeyGen). Muốn thêm provider khác (Tavus, Anam, Beyond Presence… đều có plugin Node), viết thêm một `AvatarProvider` trong `artifacts/api-server/src/agent/providers.ts`.

## Chạy local

Yêu cầu: Node 22+, pnpm 10, PostgreSQL.

```bash
pnpm install
```

```bash
cp .env.example .env   # rồi điền key (để trống = chế độ demo)
```

```bash
createdb sensei
```

```bash
set -a && source .env && set +a && pnpm --filter @workspace/db run push
```

Chạy API (port 8080, tự seed 10 bài N5; nếu đủ key LiveKit + voice sẽ tự chạy luôn agent worker):

```bash
set -a && source .env && set +a && PORT=8080 pnpm --filter @workspace/api-server run dev
```

Chạy web (port 5173, `/api` được proxy sang 8080):

```bash
set -a && source .env && set +a && PORT=5173 BASE_PATH=/ pnpm --filter @workspace/sensei-ai run dev
```

Mở http://localhost:5173 → *Try a lesson* → Dashboard → *Vào phòng học* → **Vào lớp** (thật) hoặc **Học thử (demo)**.

Lệnh khác:

```bash
pnpm run typecheck
```

```bash
pnpm --filter @workspace/api-spec run codegen
```

(Sau khi sửa `lib/api-spec/openapi.yaml`.)

## Các giai đoạn

- GĐ1 phòng học voice + phụ đề ✅
- GĐ2 avatar (LiveAvatar, fallback ảnh tĩnh) ✅
- GĐ3 bảng trắng + tool calls + giáo trình N5 ✅
- GĐ4 sổ tay SRS, lịch sử, dashboard ✅

Chưa làm / cần làm tiếp: chưa test end-to-end với key thật (LiveKit/Gemini/LiveAvatar); chưa đo độ trễ thực tế (mục tiêu < 1.5s phụ thuộc Gemini Live + region LiveKit); buổi học bị bỏ dở mà agent cũng chết thì không được tính phút.
