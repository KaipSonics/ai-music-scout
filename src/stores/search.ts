import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSearchStore = defineStore('search', () => {
  const userSearchQuery = ref('Автоматический поиск 30 неповторяющихся клиенто-артистов всех жанров');
  const rawCandidates = ref<any[]>([]);
  const filteredResults = ref<any[]>([]);
  const rejectedResults = ref<any[]>([]);
  const strategyInfo = ref<any>(null);
  const aiProfileMap = ref<Record<string, any>>({});
  const currentStep = ref<number>(0);
  const stepMessage = ref<string>('');
  const error = ref<string>('');
  const isSearching = ref<boolean>(false);

  const resetSearch = () => {
    rawCandidates.value = [];
    filteredResults.value = [];
    rejectedResults.value = [];
    strategyInfo.value = null;
    aiProfileMap.value = {};
    error.value = '';
  };

  return {
    userSearchQuery,
    rawCandidates,
    filteredResults,
    rejectedResults,
    strategyInfo,
    aiProfileMap,
    currentStep,
    stepMessage,
    error,
    isSearching,
    resetSearch
  };
});
