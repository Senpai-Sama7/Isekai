import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import axios from 'axios';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (url.includes('/api/health')) {
      return Promise.resolve({ data: { status: 'ok', services: { backend: 'ok', planner: 'ok', sandbox: 'ok' }, timestamp: new Date().toISOString() } });
    }

    if (url.includes('/api/apps')) {
      return Promise.resolve({ data: { apps: [] } });
    }

    return Promise.resolve({ data: {} });
  });

  axios.post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders Isekai AI Agent header', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/Isekai AI Agent/i)).toBeInTheDocument();
  });
});
