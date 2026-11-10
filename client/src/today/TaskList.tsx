import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../shared/api.ts';
import { describeError } from '../shared/forms.tsx';
import { formatTime } from '../shared/time.ts';
import type { CheckoutTask } from './types.ts';

type Props = {
  visitId: number;
  tasks: CheckoutTask[];
  onChange: (tasks: CheckoutTask[]) => void;
  canAdd?: boolean;
  canTick?: boolean;
  tickDisabledReason?: string;
};

export function TaskList({ visitId, tasks, onChange, canAdd, canTick, tickDisabledReason }: Props) {
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const task = await api<CheckoutTask>(`/appointments/${visitId}/checkout-tasks`, { method: 'POST', body: { description } });
      onChange([...tasks, task]);
      setDescription('');
      setError(null);
    } catch (err) {
      setError(describeError(err).fields.description?.[0] ?? (err as Error).message);
    }
  }

  async function tick(task: CheckoutTask, completed: boolean) {
    try {
      const updated = await api<CheckoutTask>(`/checkout-tasks/${task.id}`, { method: 'PATCH', body: { completed } });
      onChange(tasks.map((t) => (t.id === updated.id ? updated : t)));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h4>Checkout tasks</h4>
      {tasks.length === 0 && <p className="muted">No tasks.</p>}
      <ul className="plain-list tasks">
        {tasks.map((task) => (
          <li key={task.id}>
            <label>
              <input
                type="checkbox"
                checked={task.completed_at !== null}
                disabled={!canTick || !!tickDisabledReason}
                onChange={(e) => tick(task, e.target.checked)}
              />{' '}
              {task.description}
            </label>
            {task.completed_by && task.completed_at && (
              <span className="muted"> · done by {task.completed_by.name} at {formatTime(task.completed_at)}</span>
            )}
          </li>
        ))}
      </ul>
      {canTick && tickDisabledReason && <p className="muted">{tickDisabledReason}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {canAdd && (
        <form className="add-task" onSubmit={add} noValidate>
          <input
            aria-label="New checkout task"
            placeholder="For example: Book follow-up in 2 weeks"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit">Add task</button>
        </form>
      )}
    </section>
  );
}
