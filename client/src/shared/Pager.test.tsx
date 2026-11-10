import { fireEvent, render, screen } from '@testing-library/react';
import { Pager } from './Pager.tsx';

test('on page 1, Previous is disabled and Next moves to page 2', () => {
  const onPage = jest.fn();
  render(<Pager page={1} pageSize={25} total={120} onPage={onPage} />);
  expect(screen.getByText('page 1 of 5')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(onPage).toHaveBeenCalledWith(2);
});

test('on the last page, Next is disabled', () => {
  render(<Pager page={5} pageSize={25} total={120} onPage={() => {}} />);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
});
