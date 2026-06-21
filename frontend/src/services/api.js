import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login')
      const isLoginPage = window.location.pathname === '/login'
      if (!isLoginRequest && !isLoginPage) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Simple, high-performance in-memory SWR cache with request deduplication
const memoryCache = new Map()
const pendingPromises = new Map()

export const getWithCache = async (url, config = {}) => {
  // If data is in cache, return immediately and trigger background refresh
  if (memoryCache.has(url)) {
    const cachedData = memoryCache.get(url)
    
    // Background fetch (silent revalidation)
    api.get(url, config).then((response) => {
      memoryCache.set(url, response.data)
      if (config.onCacheUpdate) {
        config.onCacheUpdate(response.data)
      }
    }).catch((err) => {
      console.error('Silent background refresh failed:', err)
    })
    
    return { data: cachedData, fromCache: true }
  }

  // If there's already an active request for this URL, await it to prevent duplicate requests
  if (pendingPromises.has(url)) {
    try {
      const data = await pendingPromises.get(url)
      return { data, fromCache: true }
    } catch (err) {
      // If the pending promise failed, re-throw
      throw err
    }
  }

  // Create new request promise
  const promise = api.get(url, config)
    .then((res) => {
      memoryCache.set(url, res.data)
      pendingPromises.delete(url)
      return res.data
    })
    .catch((err) => {
      pendingPromises.delete(url)
      throw err
    })

  pendingPromises.set(url, promise)
  
  try {
    const data = await promise
    return { data, fromCache: false }
  } catch (err) {
    throw err
  }
}

export const clearCache = () => {
  memoryCache.clear()
  pendingPromises.clear()
}

export default api
