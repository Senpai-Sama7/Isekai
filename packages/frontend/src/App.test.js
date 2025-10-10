import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Isekai AI Agent header', () => {
  render(<App />);
  const headerElement = screen.getByText(/Isekai AI Agent/i);
  expect(headerElement).toBeInTheDocument();
});
