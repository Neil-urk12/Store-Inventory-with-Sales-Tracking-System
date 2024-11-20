import { defineStore } from "pinia"
import { auth } from "src/firebase/firebaseconfig"
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth"

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }),

  getters: {
    getUser: (state) => state.user,
    getIsAuthenticated: (state) => state.isAuthenticated,
    getLoading: (state) => state.loading,
    getError: (state) => state.error
  },

  actions: {
    async loginWithEmail(email, password, rememberMe = false) {
      if (!email || !password) throw new Error('Email and password are required')

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (!emailRegex.test(email)) throw new Error('Invalid email format')

      this.loading = true
      this.error = null

      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)

        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        this.user = userCredential.user
        this.isAuthenticated = true
        return true
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async loginWithPasskey(key, rememberMe = false) {
      if (!key) throw new Error('Passkey is required')
      if (key.length < 6) throw new Error('Passkey must be at least 6 characters')

      this.loading = true
      this.error = null

      try {
        const db = getFirestore()
        const passkeysRef = collection(db, 'passkeys')
        const q = query(
          passkeysRef,
          where('key', '==', key),
          where('active', '==', true),
          limit(1)
        )

        const snapshot = await getDocs(q)
        if (snapshot.empty) throw new Error('Invalid passkey')

        const passkey = snapshot.docs[0].data()
        if (passkey.expiresAt && passkey.expiresAt.toDate() < new Date())
          throw new Error('Passkey has expired')

        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)

        this.isAuthenticated = true
        this.user = {
          email: 'admin@example.com',
          role: 'admin',
          displayName: 'Administrator',
          id: 'admin-user'
        }
        return true
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      this.loading = true
      try {
        await signOut(auth)
        this.user = null
        this.isAuthenticated = false
        return true
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async resetPassword(email) {
      if (!email) throw new Error('Email is required')

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) throw new Error('Invalid email format')

      this.loading = true
      this.error = null
      try {
        await sendPasswordResetEmail(auth, email)
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    initializeAuthListener() {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          this.user = user
          this.isAuthenticated = true
        } else {
          this.user = null
          this.isAuthenticated = false
        }
      })
    }
  }
})
