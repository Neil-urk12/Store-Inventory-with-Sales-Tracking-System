<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

const router = useRouter()
const authStore = useAuthStore()
const $q = useQuasar()

const email = ref('')
const password = ref('')
const isPwd = ref(true)
const rememberMe = ref(false)
const resetEmail = ref('')
const loginAttempts = ref(0)
const isLocked = ref(false)

// Passkey login form data
const passKey = ref('')
const isPassKeyVisible = ref(false)

// Modal controls
const emailLoginModal = ref(false)
const passKeyLoginModal = ref(false)
const forgotPasswordDialog = ref(false)

const clearForm = () => {
  email.value = ''
  password.value = ''
  passKey.value = ''
  resetEmail.value = ''
  rememberMe.value = false
}

onMounted(() => {
  emailLoginModal.value = true
  authStore.initializeAuthListener()
})

const toggleLoginMode = () => {
  clearForm()
  emailLoginModal.value = !emailLoginModal.value
  passKeyLoginModal.value = !passKeyLoginModal.value
}

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const onSubmit = async () => {
  if (isLocked.value) {
    $q.notify({
      type: 'negative',
      message: 'Too many attempts. Please try again later.'
    })
    return
  }

  if (!email.value || !password.value) {
    $q.notify({
      type: 'negative',
      message: 'Please fill in all required fields'
    })
    return
  }

  if (!validateEmail(email.value)) {
    $q.notify({
      type: 'negative',
      message: 'Please enter a valid email address'
    })
    return
  }

  try {
    const success = await authStore.loginWithEmail(email.value, password.value, rememberMe.value)
    if (success) {
      loginAttempts.value = 0
      clearForm()
      router.push('/')
      $q.notify({
        type: 'positive',
        message: 'Login successful!'
      })
    }
  } catch (error) {
    loginAttempts.value++
    if (loginAttempts.value >= 5) {
      isLocked.value = true
      setTimeout(() => {
        isLocked.value = false
        loginAttempts.value = 0
      }, 300000)
    }
    $q.notify({
      type: 'negative',
      message: error.message || 'Login failed'
    })
  }
}

const onPassKeySubmit = async () => {
  if (!passKey.value) {
    $q.notify({
      type: 'negative',
      message: 'Please enter your passkey'
    })
    return
  }

  if (passKey.value.length < 6) {
    $q.notify({
      type: 'negative',
      message: 'Passkey must be at least 6 characters'
    })
    return
  }

  try {
    const success = await authStore.loginWithPasskey(passKey.value, rememberMe.value)
    if (success) {
      clearForm()
      router.push('/')
      $q.notify({
        type: 'positive',
        message: 'Login successful!'
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Passkey login failed'
    })
  }
}

const onForgotPassword = () => {
  resetEmail.value = email.value
  forgotPasswordDialog.value = true
}

const onResetPassword = async () => {
  if (!resetEmail.value) {
    $q.notify({
      type: 'negative',
      message: 'Please enter your email address'
    })
    return
  }

  if (!validateEmail(resetEmail.value)) {
    $q.notify({
      type: 'negative',
      message: 'Please enter a valid email address'
    })
    return
  }

  try {
    await authStore.resetPassword(resetEmail.value)
    forgotPasswordDialog.value = false
    clearForm()
    $q.notify({
      type: 'positive',
      message: 'Password reset link sent to your email'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to send reset link'
    })
  }
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container class="bg-grey-2">
      <q-page class="flex flex-center">
        <!-- Email Login Modal -->
        <q-dialog v-model="emailLoginModal" persistent>
          <q-card class="login-card q-pa-lg">
            <q-card-section class="text-center">
              <div class="text-h5 text-weight-bold q-mb-md">Welcome Back</div>
              <div class="text-grey-6">Sign in to continue</div>
            </q-card-section>

            <q-card-section>
              <q-form @submit.prevent="onSubmit" class="q-gutter-md">
                <q-input
                  v-model="email"
                  type="email"
                  label="Email"
                  filled
                  @keyup.enter="onSubmit"
                  :disable="authStore.getLoading || isLocked"
                  :rules="[
                    val => !!val || 'Email is required',
                    val => validateEmail(val) || 'Invalid email format'
                  ]"
                >
                  <template v-slot:prepend>
                    <q-icon name="email" />
                  </template>
                </q-input>

                <q-input
                  v-model="password"
                  :type="isPwd ? 'password' : 'text'"
                  label="Password"
                  filled
                  @keyup.enter="onSubmit"
                  :disable="authStore.getLoading || isLocked"
                  :rules="[val => !!val || 'Password is required']"
                >
                  <template v-slot:prepend>
                    <q-icon name="lock" />
                  </template>
                  <template v-slot:append>
                    <q-icon
                      :name="isPwd ? 'visibility_off' : 'visibility'"
                      class="cursor-pointer"
                      @click="isPwd = !isPwd"
                    />
                  </template>
                </q-input>

                <div class="flex justify-between items-center q-mt-sm">
                  <q-checkbox v-model="rememberMe" label="Remember me" />
                  <q-btn flat color="primary" label="Forgot Password?" @click="onForgotPassword" />
                </div>

                <q-btn
                  type="submit"
                  color="primary"
                  class="full-width q-mt-lg"
                  size="lg"
                  :loading="authStore.getLoading"
                  :disable="authStore.getLoading || isLocked"
                  label="Sign In"
                />
                <q-btn
                  color="primary"
                  class="full-width q-mt-lg q-mr-md"
                  size="lg"
                  label="Sign In with Key"
                  @click="toggleLoginMode"
                />
              </q-form>

            </q-card-section>
          </q-card>
        </q-dialog>

        <q-dialog v-model="passKeyLoginModal" persistent>
          <q-card class="login-card q-pa-lg">
            <q-card-section class="text-center">
              <div class="text-h5 text-weight-bold q-mb-md">Login with Key</div>
              <div class="text-grey-6">Enter your passkey to continue</div>
            </q-card-section>

            <q-card-section>
              <q-form @submit.prevent="onPassKeySubmit" class="q-gutter-md">
                <q-input
                  v-model="passKey"
                  :type="isPassKeyVisible ? 'text' : 'password'"
                  label="Passkey"
                  filled
                  @keyup.enter="onPassKeySubmit"
                  :disable="authStore.getLoading"
                  :rules="[
                    val => !!val || 'Passkey is required',
                    val => val.length >= 6 || 'Passkey must be at least 6 characters'
                  ]"
                >
                  <template v-slot:prepend>
                    <q-icon name="key" />
                  </template>
                  <template v-slot:append>
                    <q-icon
                      :name="isPassKeyVisible ? 'visibility_off' : 'visibility'"
                      class="cursor-pointer"
                      @click="isPassKeyVisible = !isPassKeyVisible"
                    />
                  </template>
                </q-input>

                <q-checkbox
                  v-model="rememberMe"
                  label="Remember me"
                  :disable="authStore.getLoading"
                />

                <q-btn
                  type="submit"
                  color="primary"
                  class="full-width q-mt-lg"
                  size="lg"
                  :loading="authStore.getLoading"
                  :disable="authStore.getLoading"
                  @click="onPassKeySubmit"
                >
                  <template v-slot:loading>
                    <q-spinner-facebook />
                  </template>
                  <span>{{ authStore.getLoading ? 'Signing in...' : 'Sign In with Key' }}</span>
                </q-btn>

                <q-btn
                  color="primary"
                  class="full-width q-mt-md"
                  size="lg"
                  :disable="authStore.getLoading"
                  @click="toggleLoginMode"
                >
                  Back to Email Sign In
                </q-btn>
              </q-form>

            </q-card-section>
          </q-card>
        </q-dialog>

        <!-- Forgot Password Dialog -->
        <q-dialog v-model="forgotPasswordDialog">
          <q-card class="login-card q-pa-lg">
            <q-card-section class="text-center">
              <div class="text-h5 text-weight-bold q-mb-md">Reset Password</div>
              <div class="text-grey-6">Enter your email to receive a reset link</div>
            </q-card-section>

            <q-card-section>
              <q-form @submit.prevent="onResetPassword" class="q-gutter-md">
                <q-input
                  v-model="resetEmail"
                  type="email"
                  label="Email"
                  filled
                  :rules="[
                    val => !!val || 'Email is required',
                    val => validateEmail(val) || 'Invalid email format'
                  ]"
                >
                  <template v-slot:prepend>
                    <q-icon name="email" />
                  </template>
                </q-input>

                <div class="row q-mt-md">
                  <q-btn
                    flat
                    color="primary"
                    label="Cancel"
                    class="col-6"
                    v-close-popup
                  />
                  <q-btn
                    type="submit"
                    color="primary"
                    label="Send Reset Link"
                    class="col-6"
                    :loading="authStore.getLoading"
                  />
                </div>
              </q-form>
            </q-card-section>
          </q-card>
        </q-dialog>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.login-card {
  width: 100%;
  max-width: 400px;
  border-radius: 12px;
}
@media (max-width: 400px) {
  .login-card {
    margin: 16px;
  }
}
</style>
