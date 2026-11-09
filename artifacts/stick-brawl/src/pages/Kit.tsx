import { useState, type ReactNode } from 'react';
import { Swords } from 'lucide-react';

import { Page } from '@/components/Layout';
import { ACCESSORIES, POSES, StickFigure, WEAPONS } from '@/components/StickFigure';
import { Badge, Bar, Burst, Button, Head, Kbd, Modal, Panel, Scribble, Slider, Star, Tabs, Toggle } from '@/components/ui';
import { ACCESSORY_LABEL, WEAPON_LABEL } from '@/lib/mock';
import { MapPicker } from '@/lib/maps';
import type { MapChoice } from '@workspace/game-core';

const SWATCHES = [
  ['--paper', 'Giấy', 'Nền trang'],
  ['--paper-2', 'Giấy 2', 'Nền phụ, thanh rỗng'],
  ['--paper-3', 'Giấy 3', 'Thẻ, ô nhập'],
  ['--ink', 'Mực', 'Viền, chữ, bóng'],
  ['--ink-soft', 'Mực nhạt', 'Chữ phụ'],
  ['--crimson', 'Đỏ', 'Đội đỏ, hành động chính, nguy hiểm'],
  ['--cobalt', 'Xanh', 'Đội xanh, điều hướng, năng lượng'],
  ['--marker', 'Bút dạ', 'Nhấn mạnh, phần thưởng'],
  ['--mint', 'Lá', 'Máu đầy, sẵn sàng, thành công'],
  ['--violet', 'Tím', 'Tuyệt chiêu'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl">{title}</h2>
      <Scribble className="mb-4 h-3 w-40" />
      {children}
    </section>
  );
}

export default function Kit() {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(60);
  const [modal, setModal] = useState(false);
  const [hp, setHp] = useState(72);
  const [map, setMap] = useState<MapChoice>('rooftop');

  return (
    <Page>
      <h1 className="font-display text-4xl">UI Kit</h1>
      <p className="text-lg text-ink-soft">
        Bộ thành phần giao diện của Que Chiến: phong cách <span className="hl">giấy vở vẽ tay</span>, có thêm chế độ bảng đen (nút mặt trăng ở góc trên).
      </p>

      <Section title="Màu sắc">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SWATCHES.map(([v, name, role]) => (
            <div key={v} className="sk bg-paper-3 p-2">
              <div className="sk h-14" style={{ background: `var(${v})` }} />
              <div className="mt-1.5 font-bold leading-tight">{name}</div>
              <code className="text-xs text-ink-soft">{v}</code>
              <div className="text-sm leading-tight text-ink-soft">{role}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Chữ">
        <Panel>
          <div className="space-y-3">
            <div className="font-display text-5xl text-paper-3 title-stroke">QUE CHIẾN</div>
            <div className="font-display text-2xl">Tiêu đề · Bungee</div>
            <div className="text-2xl">Nội dung · Patrick Hand — chữ viết tay dễ đọc, có dấu tiếng Việt đầy đủ.</div>
            <div className="text-ink-soft">Chữ phụ / chú thích · màu mực nhạt</div>
            <div>
              Dùng <span className="hl">bút dạ</span> để nhấn mạnh, phím tắt như <Kbd>J</Kbd> <Kbd>Space</Kbd>.
            </div>
          </div>
        </Panel>
      </Section>

      <Section title="Nút">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="red">
            <Swords size={18} strokeWidth={3} /> Chơi ngay
          </Button>
          <Button variant="blue">Sảnh</Button>
          <Button variant="yellow">Ghép nhanh</Button>
          <Button variant="green">Sẵn sàng</Button>
          <Button>Huỷ</Button>
          <Button variant="ink">Mực</Button>
          <Button disabled>Đã khoá</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button size="sm" variant="red">Nhỏ</Button>
          <Button size="md" variant="red">Vừa</Button>
          <Button size="lg" variant="red">Lớn</Button>
          <Button size="xl" variant="red">Rất lớn</Button>
        </div>
      </Section>

      <Section title="Thanh trạng thái">
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Máu / Nộ / Kinh nghiệm">
            <div className="space-y-3">
              <Bar label="Máu" value={hp} showValue segments={10} color={hp > 50 ? 'var(--mint)' : hp > 25 ? 'var(--marker)' : 'var(--crimson)'} />
              <Bar label="Nộ" value={100} segments={4} color="var(--violet)" height="h-3" />
              <Bar label="Kinh nghiệm" value={640} max={1000} showValue color="var(--cobalt)" height="h-3" />
              <Slider label="Thử đổi máu" value={hp} onChange={setHp} />
            </div>
          </Panel>
          <Panel title="Huy hiệu" tone="paper-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone="red">Đội Đỏ</Badge>
              <Badge tone="blue">Đội Xanh</Badge>
              <Badge tone="yellow">MVP</Badge>
              <Badge tone="green">Sẵn sàng</Badge>
              <Badge>Đang chọn…</Badge>
              <Badge tone="ink">Lv10</Badge>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Head color="var(--crimson)" />
              <Head color="var(--cobalt)" />
              <Head color="var(--mint)" />
              <Star className="h-9 w-9" />
              <Star className="h-9 w-9" color="var(--crimson)" />
            </div>
          </Panel>
        </div>
      </Section>

      <Section title="Điều khiển form">
        <div className="grid gap-6 md:grid-cols-2">
          <Panel>
            <div className="space-y-4">
              <Tabs<'a' | 'b' | 'c'>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'a', label: 'Đồng đội' },
                  { value: 'b', label: 'Hỗn chiến' },
                  { value: 'c', label: 'Giữ đồi' },
                ]}
              />
              <input className="input-sk" placeholder="Ô nhập chữ…" />
              <Toggle label="Công tắc" checked={on} onChange={setOn} />
              <Slider label="Âm lượng" value={vol} onChange={setVol} />
            </div>
          </Panel>
          <Panel title="Hộp thoại" tape>
            <p className="mb-4">Hộp thoại có băng dính, nền mờ, đóng bằng Esc.</p>
            <Button variant="blue" onClick={() => setModal(true)}>
              Mở hộp thoại
            </Button>
          </Panel>
        </div>
      </Section>

      <Section title="Hiệu ứng truyện tranh">
        <div className="flex flex-wrap items-center gap-4">
          <Burst text="BỐP!" size={110} />
          <Burst text="HỰ!" size={110} color="var(--paper-3)" />
          <Burst text="K.O!" size={110} color="var(--crimson)" />
          <Burst text="SIÊU CẤP!" size={130} color="var(--violet)" />
          <Burst text="CHẶN!" size={110} color="var(--cobalt)" />
        </div>
      </Section>

      <Section title="Bản đồ">
        <p className="mb-3 text-ink-soft">Mỗi bản đồ có địa hình riêng (vực, dung nham, bục di động, gió). Hình vẽ dùng chính dữ liệu va chạm của server.</p>
        <MapPicker value={map} onChange={setMap} />
      </Section>

      <Section title="Người que · Tư thế">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {POSES.map((p, i) => (
            <div key={p} className="sk bg-paper-3 p-2 text-center">
              <StickFigure pose={p} phase={i * 0.3} className="mx-auto aspect-square w-full max-w-28" />
              <code className="text-sm">{p}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Người que · Phụ kiện & vũ khí">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {ACCESSORIES.map((a) => (
            <div key={a} className="sk bg-paper-3 p-2 text-center">
              <StickFigure accessory={a} color="var(--cobalt)" className="mx-auto aspect-square w-full max-w-24" />
              <div className="text-sm">{ACCESSORY_LABEL[a]}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {WEAPONS.map((w) => (
            <div key={w} className="sk bg-paper-3 p-2 text-center">
              <StickFigure weapon={w} pose="punch" color="var(--crimson)" className="mx-auto aspect-square w-full max-w-28" />
              <div className="text-sm">{WEAPON_LABEL[w]}</div>
            </div>
          ))}
        </div>
      </Section>

      <Modal open={modal} onClose={() => setModal(false)} title="Xác nhận">
        <p>Bạn có chắc muốn rời trận? Bạn sẽ mất phần thưởng của trận này.</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button onClick={() => setModal(false)}>Ở lại</Button>
          <Button variant="red" onClick={() => setModal(false)}>
            Rời trận
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
