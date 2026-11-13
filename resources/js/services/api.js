
import axios from 'axios';

const api = axios.create({
    baseURL: window.location.origin,
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

// Memasang token ketika aplikasi dibuka
const savedToken = sessionStorage.getItem('printflow_token');

if (savedToken) {
    api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

// Mengatur token login dan logout
export function setAuthToken(token) {
    if (token) {
        sessionStorage.setItem('printflow_token', token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
        sessionStorage.removeItem('printflow_token');
        delete api.defaults.headers.common.Authorization;
    }
}

export default api;
