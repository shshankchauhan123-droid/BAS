import { apiRequest } from './client';

export const getDashboardStatistics = async () => {
  const response = await apiRequest('/api/v1/dashboard/statistics', { method: 'GET' });
  return response;
};
