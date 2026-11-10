type Props = { page: number; pageSize: number; total: number; onPage: (page: number) => void };

export function Pager({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="pager" aria-label="Pages">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}>Previous</button>
      <span>page {page} of {pages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages}>Next</button>
    </nav>
  );
}
