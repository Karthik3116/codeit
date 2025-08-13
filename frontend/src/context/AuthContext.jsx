import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUserInfo = localStorage.getItem('userInfo');
        if (storedUserInfo) {
            const userInfo = JSON.parse(storedUserInfo);
            try {
                const decodedToken = jwtDecode(userInfo.token);
                if (decodedToken.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setUser(userInfo);
                }
            } catch (error) {
                console.error("Invalid token:", error);
                logout();
            }
        }
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await API.post('/auth/login', { email, password });
            localStorage.setItem('userInfo', JSON.stringify(data));
            setUser(data);
            toast.success("Login successful!");
            navigate('/dashboard');
        } catch (error) {
            const message = error.response?.data?.message || "Login failed!";
            toast.error(message);
            console.error(error);
        }
    };

    const signup = async (name, email, password) => {
        try {
            const { data } = await API.post('/auth/register', { name, email, password });
            localStorage.setItem('userInfo', JSON.stringify(data));
            setUser(data);
            toast.success("Signup successful!");
            navigate('/dashboard');
        } catch (error) {
             const message = error.response?.data?.message || "Signup failed!";
            toast.error(message);
            console.error(error);
        }
    };

    const logout = () => {
        localStorage.removeItem('userInfo');
        setUser(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, signup }}>
            {children}
        </AuthContext.Provider>
    );
};