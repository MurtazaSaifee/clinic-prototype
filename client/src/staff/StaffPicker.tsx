import { useEffect, useState } from 'react';
import { api, getStaffId, setStaffId } from '../shared/api.ts';
import { labels } from '../shared/labels.ts';
import type { Staff } from './types.ts';

export function StaffPicker() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState(getStaffId());

  useEffect(() => {
    api<Staff[]>('/staff').then(setStaff).catch(() => setStaff([]));
  }, []);

  function choose(value: string) {
    const id = value ? Number(value) : null;
    setStaffId(id);
    setSelected(id);
  }

  return (
    <label className="staff-picker">
      Signed in as{' '}
      <select value={selected ?? ''} onChange={(e) => choose(e.target.value)}>
        <option value="">Choose staff member</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({labels[s.role]})</option>
        ))}
      </select>
    </label>
  );
}
