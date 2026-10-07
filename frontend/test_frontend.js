import { searchCaseTransactions } from './src/services/api/bankTransaction.js';
console.log(searchCaseTransactions(37, { channel: 'NEFT' }));
