import axios from 'axios';
const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: API, timeout: 30000 });
export async function getBreeds() { const { data } = await api.get('/api/breeds'); return data.breeds; }
export async function recognizeBreed(file) { const form = new FormData(); form.append('file', file); const { data } = await api.post('/api/recognize', form); return data; }
export async function getHistory(limit=20,offset=0) { const { data } = await api.get('/api/history',{params:{limit,offset}}); return data; }
