<template>
  <q-page class="q-pa-md">
    <q-list>
      <q-expansion-item
        v-for="category in categories"
        :key="category.id"
        :label="category.name"
        header-class="text-weight-bold"
        expand-icon-class="text-primary"
      >
        <q-list>
          <q-item v-for="contact in category.contacts" :key="contact.id" class="q-mb-md">
            <q-item-section avatar>
              <q-avatar>
                <img :src="contact.avatar" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ contact.name }}</q-item-label>
              <q-item-label caption>{{ contact.email }}</q-item-label>
              <q-item-label caption>{{ contact.phone }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn icon="phone" color="primary" flat round @click="callContact(contact.phone)" />
              <q-btn icon="email" color="secondary" flat round @click="emailContact(contact.email)" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </q-list>
  </q-page>
</template>

<script setup>
import { ref } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();

const categories = ref([
  {
    id: 1,
    name: 'Ice Cream Delivery',
    contacts: [
      {
        id: 1,
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        avatar: 'https://via.placeholder.com/150'
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+0987654321',
        avatar: 'https://via.placeholder.com/150'
      }
    ]
  },
  {
    id: 2,
    name: 'Grocery Delivery',
    contacts: [
      {
        id: 3,
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        phone: '+1122334455',
        avatar: 'https://via.placeholder.com/150'
      }
    ]
  },
  {
    id: 3,
    name: 'Store Restock',
    contacts: [
      {
        id: 4,
        name: 'Bob Brown',
        email: 'bob.brown@example.com',
        phone: '+9988776655',
        avatar: 'https://via.placeholder.com/150'
      }
    ]
  },
  {
    id: 4,
    name: 'Family',
    contacts: [
      {
        id: 5,
        name: 'Sara Lee',
        email: 'sara.lee@example.com',
        phone: '+1234567890',
        avatar: 'https://via.placeholder.com/150'
      }
    ]
  },
  {
    id: 5,
    name: 'Partners',
    contacts: [
      {
        id: 6,
        name: 'Tom Wilson',
        email: 'tom.wilson@example.com',
        phone: '+0987654321',
        avatar: 'https://via.placeholder.com/150'
      }
    ]
  }
]);

const callContact = (phone) => {
  $q.dialog({
    title: 'Call',
    message: `Call ${phone}?`,
    ok: 'Call',
    cancel: 'Cancel'
  }).onOk(() => {
    window.location.href = `tel:${phone}`;
  });
};

const emailContact = (email) => {
  $q.dialog({
    title: 'Email',
    message: `Email ${email}?`,
    ok: 'Email',
    cancel: 'Cancel'
  }).onOk(() => {
    window.location.href = `mailto:${email}`;
  });
};
</script>

<style scoped>
.q-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
}

.q-item:hover {
  background: #f5f5f5;
}

.q-item .q-item__section--avatar {
  margin-right: 16px;
}

.q-item .q-item__section--side {
  display: flex;
  align-items: center;
}

.q-item .q-btn {
  margin-left: 8px;
}

.q-expansion-item__container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 16px;
}

.q-expansion-item__content {
  padding: 16px;
  background: #f9f9f9;
}
</style>
