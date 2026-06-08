import { apiClient } from './client';

export const getBureauClients = async () => {
  const res = await apiClient.get('/bureau/clients');
  return res.data;
};

export const getBureauEarnings = async () => {
  const res = await apiClient.get('/bureau/earnings');
  return res.data;
};

export const getBureauProposals = async () => {
  const res = await apiClient.get('/bureau/proposals');
  return res.data;
};

export const createMatchProposal = async (clientUserId: string, proposedUserId: string, notes?: string) => {
  const res = await apiClient.post('/bureau/proposals', { clientUserId, proposedUserId, notes });
  return res.data;
};
