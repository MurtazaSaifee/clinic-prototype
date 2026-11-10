import { render, screen } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import { StudiesPage } from './StudiesPage.tsx';

test('shows the study and its criteria in plain words', async () => {
  mockFetch({
    '/api/studies': {
      body: [
        {
          id: 1,
          name: 'GLUCO-STEP',
          description: 'A fictional 12-week lifestyle study.',
          criteria: [
            { type: 'AGE_BETWEEN', min: 18, max: 75 },
            { type: 'DIAGNOSIS', icd10_prefixes: ['E11'], label: 'Type 2 diabetes' },
          ],
        },
      ],
    },
    '/api/studies/1/matches': { body: { data: [], page: 1, page_size: 10, total: 0 } },
  });
  render(<StudiesPage currentStaff={null} />);
  expect(await screen.findByRole('heading', { name: 'GLUCO-STEP' })).toBeInTheDocument();
  expect(screen.getByText('Aged 18 to 75')).toBeInTheDocument();
  expect(screen.getByText('Type 2 diabetes (diagnosis code starting E11)')).toBeInTheDocument();
});
