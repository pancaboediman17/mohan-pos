
import axios from 'axios';

const TOKEN_KEY = 'mohan_digital_labs_token';
const LEGACY_TOKEN_KEY = 'printflow_token';

const api = axios.create({
    baseURL: window.location.origin,
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

// Memasang token ketika aplikasi dibuka
const savedToken =
    sessionStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(LEGACY_TOKEN_KEY);

if (savedToken) {
    sessionStorage.setItem(TOKEN_KEY, savedToken);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

export function getAuthToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

// Mengatur token login dan logout
export function setAuthToken(token) {
    if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(LEGACY_TOKEN_KEY);
        delete api.defaults.headers.common.Authorization;
    }
}

export default api;
