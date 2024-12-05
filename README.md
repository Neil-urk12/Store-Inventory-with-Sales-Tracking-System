# Store Inventory with Sales Tracking System
A system that can help small business owners track their stocks and sales with a very user-friendly interface and great ux design.

## Features

- **Inventory Management**: Track products, stock levels, and categories
- **Sales Reports**: Visualize sales data with interactive charts
- **Contact Management**: Manage customers and suppliers
- **Offline Support**: Full offline functionality with data sync
- **Progressive Web App**: Install and use like a native app
- **Modern UI/UX**: Beautiful and responsive design

## Tech Stack
![alt text](https://img.shields.io/badge/vuejs-%2335495e.svg?style=for-the-badge&logo=vue.js&logoColor=%234FC08D)![alt text](https://img.shields.io/badge/Quasar-1976D2?style=for-the-badge&logo=quasar&logoColor=white)![alt text](https://img.shields.io/badge/pinia-%2340B883.svg?style=for-the-badge&logo=pinia&logoColor=white)![alt text](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase)![alt text](https://img.shields.io/badge/Dexie.js-orange?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTAgMjUwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTI1IDBDNTYuMDIgMCAwIDU2LjAyIDAgMTI1czU2LjAyIDEyNSAxMjUgMTI1IDEyNS01Ni4wMiAxMjUtMTI1UzE5My45OCAwIDEyNSAwem0tMTcuNDUgMTc2LjQyYy0xLjYgMS42LTMuOTUgMi4zNS02LjMgMi4zNS0yLjM1IDAtNC43NS0uNzUtNi4zLTIuMzVsLTMzLjktMzMuOWMtMy4xLTMuMS0zLjEtOC4xNSAwLTExLjI1bDMzLjktMzMuOWMxLjYtMS42IDMuOTUtMi4zNSA2LjMtMi4zNSAyLjM1IDAgNC43NS43NSA2LjMtMi4zNWwzMy45IDMzLjljMy4xIDMuMSAzLjEgOC4xNSAwIDExLjI1bC0zMy45IDMzLjkzem0xMDMuNzUtODguMjJjMC0yMy44LTE5LjItNDMtNDMtNDNIMTA5Yy0yMy44IDAtNDMgMTkuMi00MyA0M3Y0M2MwIDIzLjggMTkuMiA0MyA0MyA0Mzh3NzMuNDVjMjMuOCAwIDQzLTE5LjIgNDMtNDN2LTQzem0tNDMgNzMuNDVIMTA5di00M2g3Ni4zMXY0M3oiLz48L3N2Zz4=)![alt text](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)![alt text](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
- **Frontend**: Vue 3 + Quasar Framework
- **State Management**: Pinia
- **Database**: Firebase
- **Offline Storage**: Dexie (IndexedDB)
- **Charts**: Chart.js
- **Build Tool**: Vite

## Prerequisites

- Node.js >= 16.x && <= 18.14.2
- npm >= 6.13.4 or yarn >= 1.21.1
- Firebase account and project

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd StoreInventorywithSalesTrackingSystem
```

2. Install dependencies:
```bash
yarn
# or
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase configuration

## Development

Start the app in development mode (hot-code reloading, error reporting, etc.):
```bash
quasar dev
```

### Build for Production

```bash
# Build for production
quasar build

# Build PWA
quasar build -m pwa
```

## Project Structure

```
src/
├── assets/         # Static assets
├── components/     # Reusable Vue components
├── pages/         # Main view components
├── stores/        # Pinia stores
├── services/      # Business logic
├── firebase/      # Firebase config
├── db/           # Database (Dexie)
└── utils/        # Utility functions
```

## Key Components

### Inventory Management
- Product CRUD operations
- Stock level tracking
- Category management

### Reporting System
- Sales analytics
- Inventory reports
- Chart visualizations
- Export functionality

### Contact Management
- Customer database
- Supplier management
- Contact history

## PWA Features

- Offline functionality
- Push notifications
- App-like experience
- Automatic updates

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email neilvallecer12@gmail.com or open an issue in the repository.
