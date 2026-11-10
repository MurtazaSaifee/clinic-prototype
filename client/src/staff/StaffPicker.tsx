import { labels } from '../shared/labels.ts';
import type { Staff } from './types.ts';

type Props = { staff: Staff[]; selectedId: number | null; onChange: (id: number | null) => void };

export function StaffPicker({ staff, selectedId, onChange }: Props) {
  return (
    <label className="staff-picker">
      Signed in as{' '}
      <select value={selectedId ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Choose staff member</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({labels[s.role]})</option>
        ))}
      </select>
    </label>
  );
}
