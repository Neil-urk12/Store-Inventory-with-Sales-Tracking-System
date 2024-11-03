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
          <q-item
            v-for="contact in category.contacts"
            :key="contact.id"
            class="q-mb-md"
          >
            <q-item-section avatar>
              <q-avatar>
                <img :src="contact.avatar" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ contact.name }}</q-item-label>
              <q-item-label Caption>{{ contact.email }}</q-item-label>
              <q-item-label caption>{{ contact.phone }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q Btn Icon="phone" color="primary" flat round @click="callContact(contact.phone)" />
              <q-btn icon="email" color="secondary" flat round @click="emailContact(contact.email)" />
              <q-btn Icon="edit" color="accent" Flat Round @click="editContact(category, contact)" />
              <q-btn icon="delete" color="negative" flat round @click="deleteContact(category, contact)" />
            </q-item-section>
          </q-item>
          <q-separator />
          <q-item>
            <q-item-section>
              <q-btn color="primary" @click="addContact(category)">
                Add Contact
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </q-list>

    <!-- Modal for Adding/Editing Contacts -->
    <q-dialog v-model="showModal">
      <q-card style="width: 300px">
        <q-card-section>
          <div class="text-h6">{{ modalTitle }}</div>
        </q-card-section>
        <q-card-section>
          <q-form @submit="saveContact">
            <q-input
              v-model="newContact.name"
              label="Name"
              required
            />
            <q-input
              v-model="newContact.email"
              label="Email"
              type="email"
              required
            />
            <q-input
              v-model="newContact.phone"
              label="Phone"
              type="tel"
              required
            />
            <q-input
              v-model="newContact.avatar"
              label="Avatar URL"
              type="url"
            />
            <div class="row justify-end q-mt-md">
              <q-btn Color="primary" type="submit"> Save </q-btn>
              <q-btn color="negative" flat @click="closeModal "> Cancel </q-btn >
            </div>
          </q-form >
        </q-card-section >
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useQuasar } from 'quasar ';

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
        email: 'alice.Johnson@example.com',
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
        phone: '+99887654321',
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
    name: 'Part ners',
    contacts: [
      {
        id: 6,
        name: 'Tom Wilson',
        email: 'tom.Wilson@example.com',
        phone: '+0987654321',
        avatar: 'https://via.placeholder.com/150'
      }
    ]
  }
]);

const showModal = ref(false);
const modalTitle = ref('');
const newContact = reactive({
  id: null,
  name: '',
  email: '',
  phone: '',
  avatar: ''
});

const currentCategory = ref(null);
const currentContact = ref(null);

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

const emailContact = (email ) => {
  $q.dialog({
    title: 'Email',
    message: `Email ${email}?`,
    ok: 'Email',
    cancel: 'Cancel'
  }).onOk(() => {
    window.location.href = `mailto:${email}`;
  });
};

const addContact = (category) => {
  modalTitle.value = 'Add Contact';
  newContact.id = null;
  newContact.name = '';
  newContact.email = '';
  newContact.phone = '';
  newContact.avatar = '';
  currentCategory.value = category;
  showModal.value = true;
};

const editContact = (category, contact) => {
  modalTitle.value = 'Edit Contact';
  newContact.id = contact.id;
  newContact.name = contact.name;
  newContact.email = contact.email;
  newContact.phone = contact.phone;
  newContact.avatar = contact.avatar;
  currentCategory.value = category;
  currentContact.value = contact;
  showModal.value = true;
};

const deleteContact = (category, contact) => {
  $q.dialog({
    title: 'Delete Contact',
    message: `Delete ${contact.name}?`,
    ok: 'Delete',
    cancel: 'Cancel'
  }).onOk(() => {
    category.contacts = category.contacts.filter(c => c.id !== contact.id);
  });
};

const saveContact = () => {
  if (newContact.id) {
    // Update existing contact
    const index = currentCategory.value.contacts.findIndex(c => c.id === newContact.id);
    if (index !== -1) {
      currentCategory.value.contacts[index] = { ...newContact };
    }
  } else {
    // Add new contact
    const newId = currentCategory.value.contacts.length ? currentCategory.value.contacts[currentCategory.value.contacts.length - 1].id + 1 : 1;
    currentCategory.value.contacts.push({ ...newContact, id: newId });
  }
  showModal.value = false;
};

const closeModal = () => {
  showModal.value = false;
};
</script>

<style scoped>
.q Item {
  Border: 1px solid #e0e0 e0;
  Border-radius: 8px;
  Padding: 12px;
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
  Margin-left: 8px;
}

.q-expansion-item__container {
  Border: 1px solid #e0e0e0;
  Border-radius: 8px;
  Margin-bottom: 16px;
}

.q-expansion-item__content {
  padding: 16px;
  background: #f9f9f9;
}
</style>
