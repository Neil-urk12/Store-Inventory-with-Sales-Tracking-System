<template>
  <div class="q-pa-md">
    <div class="row q-col-gutter-md">
      <!-- Profile Header -->
      <div class="col-12">
        <q-card class="profile-header">
          <q-card-section class="row items-center">
            <div class="col-12 col-sm-3 text-center">
              <q-avatar size="150px">
                <img src="https://picsum.photos/150/150" />
              </q-avatar>
            </div>
            <div class="col-12 col-sm-9 q-pt-md q-pt-sm-none">
              <div class="text-h4">John Doe</div>
              <div class="text-subtitle1">Inventory Manager</div>
              <div class="text-caption">Member since: January 2023</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Profile Details -->
      <div class="col-12 col-md-8">
        <q-card>
          <q-card-section>
            <div class="text-h6">Profile Details</div>
          </q-card-section>

          <q-card-section>
            <q-form @submit="onSubmit" class="q-gutter-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.firstName"
                    label="First Name"
                    outlined
                    dense
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.lastName"
                    label="Last Name"
                    outlined
                    dense
                  />
                </div>
                <div class="col-12">
                  <q-input
                    v-model="form.email"
                    label="Email"
                    type="email"
                    outlined
                    dense
                  />
                </div>
                <div class="col-12">
                  <q-input
                    v-model="form.phone"
                    label="Phone"
                    outlined
                    dense
                    mask="(###) ###-####"
                  />
                </div>
                <div class="col-12">
                  <q-input
                    v-model="form.position"
                    label="Position"
                    outlined
                    dense
                  />
                </div>
              </div>

              <div class="row q-gutter-sm justify-end">
                <q-btn
                  label="Cancel"
                  color="grey"
                  flat
                  :disable="!isFormChanged"
                  @click="resetForm"
                />
                <q-btn
                  label="Save Changes"
                  color="primary"
                  type="submit"
                  :disable="!isFormChanged"
                />
              </div>
            </q-form>
          </q-card-section>
        </q-card>
      </div>

      <!-- Stats Card -->
      <div class="col-12 col-md-4">
        <q-card>
          <q-card-section>
            <div class="text-h6">Activity Stats</div>
          </q-card-section>

          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <div class="text-h5">156</div>
                <div class="text-caption">Items Added</div>
              </div>
              <div class="col-6">
                <div class="text-h5">43</div>
                <div class="text-caption">Updates Made</div>
              </div>
              <div class="col-6">
                <div class="text-h5">89%</div>
                <div class="text-caption">Task Completion</div>
              </div>
              <div class="col-6">
                <div class="text-h5">12</div>
                <div class="text-caption">Days Active</div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6">Recent Activity</div>
          </q-card-section>

          <q-list>
            <q-item v-for="activity in recentActivity" :key="activity.id">
              <q-item-section avatar>
                <q-icon :name="activity.icon" :color="activity.color" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ activity.action }}</q-item-label>
                <q-item-label caption>{{ activity.timestamp }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const initialForm = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '(555) 123-4567',
  position: 'Inventory Manager'
}

const form = ref({ ...initialForm })

const isFormChanged = computed(() => {
  return Object.keys(initialForm).some(key => initialForm[key] !== form.value[key])
})

const recentActivity = [
  {
    id: 1,
    action: 'Added new inventory item',
    timestamp: '2 hours ago',
    icon: 'add_circle',
    color: 'positive'
  },
  {
    id: 2,
    action: 'Updated stock quantities',
    timestamp: '5 hours ago',
    icon: 'update',
    color: 'info'
  },
  {
    id: 3,
    action: 'Removed discontinued item',
    timestamp: '1 day ago',
    icon: 'delete',
    color: 'negative'
  }
]

const onSubmit = () => {
  // Handle form submission
  console.log('Form submitted:', form.value)
}

const resetForm = () => {
  form.value = { ...initialForm }
}
</script>

<style lang="scss" scoped>
.profile-header {
  background: linear-gradient(145deg, #1976d2 0%, #0d47a1 100%);
  color: white;
}

.q-avatar {
  border: 4px solid white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}
</style>
