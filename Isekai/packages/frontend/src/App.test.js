import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Dream AI Agent header', () => {
  render(<App />);
  const headerElement = screen.getByText(/Dream AI Agent/i);
  expect(headerElement).toBeInTheDocument();
});
