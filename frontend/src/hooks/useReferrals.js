import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

export const useReferrals = () => {
  return useQuery({
    queryKey: ['referrals'],
    queryFn: async () => {
      const res = await api.get('/referrals/my-referrals');
      return res.data.data;
    },
  });
};

export const useInbox = () => {
  return useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      const res = await api.get('/referrals/inbox');
      return res.data.data;
    },
  });
};

export const useAdmissions = () => {
  return useQuery({
    queryKey: ['admissions'],
    queryFn: async () => {
      const res = await api.get('/hospitals/admissions');
      return res.data.data;
    },
  });
};

export const useHospitalPipeline = () => {
  return useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const res = await api.get('/hospitals/referrals-pipeline');
      return res.data.data;
    },
  });
};

export const useBeds = () => {
  return useQuery({
    queryKey: ['beds'],
    queryFn: async () => {
      const res = await api.get('/hospitals/beds');
      return res.data.data;
    },
  });
};

export const useHospitalReferrals = () => {
  return useQuery({
    queryKey: ['hospital-referrals'],
    queryFn: async () => {
      const res = await api.get('/referrals/hospital-all');
      return res.data.data;
    },
  });
};
