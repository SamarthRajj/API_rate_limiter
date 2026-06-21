jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

jest.mock('./components/RealtimeDashboard', () => () => (
  <div>Realtime Dashboard</div>
));

jest.mock('./components/AdminPanel', () => () => (
  <div>Admin Panel</div>
));

jest.mock('./components/Analytics', () => () => (
  <div>Analytics</div>
));

import { render, screen } from '@testing-library/react';
import App from './App';

test('renders rate limiter navigation', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /Rate Limiter/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Dashboard/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Admin Panel/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Analytics/i })).toBeInTheDocument();
  expect(screen.getByText('Realtime Dashboard')).toBeInTheDocument();
});
